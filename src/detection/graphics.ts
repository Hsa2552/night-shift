// Éléments graphiques (figures, tableaux, cadres, traits) : le texte extrait ne les décrit pas.
// On les repère dans le rendu raster comme de l'encre située hors des fragments de texte,
// pour qu'un masque de correction ne coupe pas une figure qui déborde de ses limites.

import type { PageData, RasterData, Rect } from './contract.ts'

export interface PageInk {
  raster: RasterData
  /** Pixels par unité canonique, sur chaque axe. */
  sx: number
  sy: number
  /** 1 si le pixel est dans un fragment de texte (marge de 1 pixel). */
  text: Uint8Array
  /** Luminance en dessous de laquelle un pixel est de l'encre (fond de page moins 10). */
  inkBelow: number
}

export function buildPageInk(raster: RasterData, page: PageData): PageInk {
  const sx = raster.width / page.width
  const sy = raster.height / page.height
  const text = new Uint8Array(raster.width * raster.height)
  for (const item of page.textItems) {
    if (item.text.trim() === '') continue
    const x0 = Math.max(0, Math.floor(item.bbox.x * sx) - 1)
    const y0 = Math.max(0, Math.floor(item.bbox.y * sy) - 1)
    const x1 = Math.min(raster.width, Math.ceil((item.bbox.x + item.bbox.width) * sx) + 1)
    const y1 = Math.min(raster.height, Math.ceil((item.bbox.y + item.bbox.height) * sy) + 1)
    for (let y = y0; y < y1; y++) text.fill(1, y * raster.width + x0, y * raster.width + x1)
  }
  return { raster, sx, sy, text, inkBelow: backgroundLuminance(raster) - 10 }
}

/** Luminance la plus fréquente (le fond de page), sur un échantillon de pixels. */
function backgroundLuminance(raster: RasterData): number {
  const histogram = new Uint32Array(256)
  const { rgba } = raster
  const step = Math.max(1, Math.floor(rgba.length / 4 / 20000)) * 4
  for (let i = 0; i < rgba.length; i += step) {
    if (rgba[i + 3]! < 128) continue
    histogram[Math.round(0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!)]!++
  }
  let best = 255
  for (let l = 0; l < 256; l++) if (histogram[l]! > histogram[best]!) best = l
  return best
}

/** Encre (sombre ou colorée) qui n'appartient à aucun fragment de texte. */
function isGraphic(ink: PageInk, x: number, y: number): boolean {
  const { raster } = ink
  const p = y * raster.width + x
  if (ink.text[p]) return false
  const i = p * 4
  const { rgba } = raster
  if (rgba[i + 3]! < 128) return false
  const r = rgba[i]!
  const g = rgba[i + 1]!
  const b = rgba[i + 2]!
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  // Relatif au fond : un cadre gris clair, même éclairci par l'anticrénelage, est de l'encre.
  return lum < ink.inkBelow || Math.max(r, g, b) - Math.min(r, g, b) >= 60
}

/**
 * Suit l'encre graphique rangée par rangée depuis les colonnes `seeds`, dans le sens `step`
 * (+1 vers le bas, -1 vers le haut), sans dépasser la rangée `limit`. Un trait horizontal
 * est suivi sur toute sa longueur. Renvoie la dernière rangée atteinte, ou null.
 */
function follow(
  ink: PageInk,
  x0: number,
  x1: number,
  seeds: Set<number>,
  from: number,
  step: 1 | -1,
  limit: number,
): number | null {
  let active = seeds
  let last: number | null = null
  for (let y = from; step > 0 ? y <= limit : y >= limit; y += step) {
    if (active.size === 0) break
    const next = new Set<number>()
    for (let x = x0; x < x1; x++) {
      if ((active.has(x - 1) || active.has(x) || active.has(x + 1)) && isGraphic(ink, x, y)) {
        next.add(x)
      }
    }
    for (const x of [...next]) {
      for (let k = x + 1; k < x1 && !next.has(k) && isGraphic(ink, k, y); k++) next.add(k)
      for (let k = x - 1; k >= x0 && !next.has(k) && isGraphic(ink, k, y); k--) next.add(k)
    }
    if (next.size === 0) break
    last = y
    active = next
  }
  return last
}

function columnsWithInk(ink: PageInk, x0: number, x1: number, y0: number, y1: number) {
  const cols = new Set<number>()
  for (let y = Math.max(0, y0); y < Math.min(ink.raster.height, y1); y++) {
    for (let x = x0; x < x1; x++) if (isGraphic(ink, x, y)) cols.add(x)
  }
  return cols
}

function pixelSpan(ink: PageInk, bbox: Rect) {
  return {
    x0: Math.max(0, Math.floor(bbox.x * ink.sx)),
    x1: Math.min(ink.raster.width, Math.ceil((bbox.x + bbox.width) * ink.sx)),
  }
}

/**
 * Si un élément graphique traverse le bas de `bbox`, renvoie l'ordonnée (repère canonique)
 * où il s'arrête, sans dépasser `limitY`. Sinon renvoie le bas d'origine.
 */
export function graphicBottom(ink: PageInk, bbox: Rect, limitY: number): number {
  const bottom = bbox.y + bbox.height
  const { x0, x1 } = pixelSpan(ink, bbox)
  const yb = Math.min(ink.raster.height, Math.round(bottom * ink.sy))
  const limit = Math.min(ink.raster.height - 1, Math.floor(limitY * ink.sy))
  const seeds = columnsWithInk(ink, x0, x1, yb - 2, yb)
  const last = follow(ink, x0, x1, seeds, yb, 1, limit)
  return last === null ? bottom : Math.max(bottom, (last + 1) / ink.sy)
}

/**
 * Cadre ou figure qui entoure la correction et dépasse au-dessus de `bbox` : renvoie le haut
 * du graphique (sans monter au-dessus de `limitY`), mais seulement si ce graphique descend
 * sur au moins la moitié de la hauteur de `bbox`. Une figure de l'énoncé qui effleure le haut
 * du masque n'est donc pas masquée. Sinon renvoie le haut d'origine.
 */
export function graphicTop(ink: PageInk, bbox: Rect, limitY: number): number {
  const top = bbox.y
  const { x0, x1 } = pixelSpan(ink, bbox)
  const yt = Math.max(0, Math.round(top * ink.sy))
  const yBottom = Math.min(ink.raster.height - 1, Math.floor((top + bbox.height) * ink.sy))
  const seeds = columnsWithInk(ink, x0, x1, yt, yt + 2)
  if (seeds.size === 0) return top
  const reached = follow(ink, x0, x1, seeds, yt, 1, yBottom)
  if (reached === null || reached - yt < 0.5 * (yBottom - yt)) return top
  const limit = Math.max(0, Math.ceil(limitY * ink.sy))
  const last = follow(ink, x0, x1, seeds, yt - 1, -1, limit)
  return last === null ? top : Math.min(top, last / ink.sy)
}
