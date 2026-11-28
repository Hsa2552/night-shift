// Cases de QCM dessinées (rectangles vectoriels) : pleines = bonne réponse, vides = autres.
// Repérées dans le rendu raster par composantes connexes d'encre sombre, indépendamment
// de leur taille exacte, de la police et de la mise en page. Le texte extrait ne les voit pas.

import type { PageData, RasterData, Rect } from './contract.ts'

export interface Box {
  pageIndex: number
  /** Rectangle de la case, repère canonique de la page. */
  bbox: Rect
  filled: boolean
  /** Part de pixels noirs dans le rectangle (proche de 1 pour une case pleine). */
  density: number
  /** Caractère extrait sous la case (lettre de la proposition, chiffre d'une grille), s'il existe. */
  char?: string
}

/** Encre : seuil large, pour suivre les contours fins anticrénelés. Noir : remplissage. */
const INK = 215
const BLACK = 140

/**
 * Cases candidates d'une page : carrés pleins (densité forte) et contours carrés à centre clair.
 * Deux passes : seuil noir (cases à bord net, proches du texte qui les suit) et seuil large
 * (contours fins anticrénelés, comme ceux des grilles de réponses), fusionnées sans doublon.
 */
export function findBoxes(raster: RasterData, page: PageData): Box[] {
  const merged: Box[] = []
  for (const box of [...scanBoxes(raster, page, BLACK), ...scanBoxes(raster, page, INK)]) {
    const cx = box.bbox.x + box.bbox.width / 2
    const cy = box.bbox.y + box.bbox.height / 2
    const twin = merged.find(
      (b) =>
        Math.abs(b.bbox.x + b.bbox.width / 2 - cx) < box.bbox.width / 3 &&
        Math.abs(b.bbox.y + b.bbox.height / 2 - cy) < box.bbox.height / 3,
    )
    if (!twin) merged.push(box)
  }
  return merged
}

function scanBoxes(raster: RasterData, page: PageData, inkThreshold: number): Box[] {
  const { width: W, height: H, rgba } = raster
  const s = W / page.width
  const dark = new Uint8Array(W * H)
  const black = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    if (rgba[i + 3]! < 128) continue
    const lum = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!
    if (lum < inkThreshold) dark[p] = 1
    if (lum < BLACK) black[p] = 1
  }
  const isDark = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && dark[y * W + x] === 1

  // Taille plausible d'une case : entre 4 et 30 points de côté.
  const minSide = Math.max(4, Math.round(4 * s))
  const maxSide = Math.round(30 * s)
  const seen = new Uint8Array(W * H)
  const stack: number[] = []
  const boxes: Box[] = []
  for (let start = 0; start < W * H; start++) {
    if (!dark[start] || seen[start]) continue
    // Composante connexe (4-connexité), avec abandon dès qu'elle dépasse la taille maximale.
    let x0 = W
    let y0 = H
    let x1 = -1
    let y1 = -1
    let count = 0
    let tooBig = false
    stack.push(start)
    seen[start] = 1
    while (stack.length > 0) {
      const p = stack.pop()!
      const x = p % W
      const y = (p - x) / W
      count++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (x1 - x0 > maxSide || y1 - y0 > maxSide) tooBig = true
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= W * H || seen[q] || !dark[q]) continue
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue
        seen[q] = 1
        stack.push(q)
      }
    }
    if (tooBig) continue
    const w = x1 - x0 + 1
    const h = y1 - y0 + 1
    if (w < minSide || h < minSide || w > maxSide || h > maxSide) continue
    const aspect = w / h
    if (aspect < 0.75 || aspect > 1.33) continue
    let blackCount = 0
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blackCount += black[y * W + x]!
    const density = blackCount / (w * h)
    let filled: boolean
    if (density >= 0.75) {
      filled = true
    } else {
      // Contour : les quatre bords sont presque entièrement sombres, le centre est clair.
      // Pour chaque bord, sa meilleure rangée (ou colonne) dans l'épaisseur t : un contour
      // anticrénelé a une ligne sombre et une ligne grise, la moyenne les mélangerait.
      const rowDark = (y: number) => {
        let d = 0
        for (let x = x0; x <= x1; x++) if (isDark(x, y)) d++
        return d / w
      }
      const colDark = (x: number) => {
        let d = 0
        for (let y = y0; y <= y1; y++) if (isDark(x, y)) d++
        return d / h
      }
      const t = Math.max(2, Math.round(w * 0.15))
      const best = (f: (k: number) => number, from: number, step: 1 | -1) => {
        let m = 0
        for (let k = 0; k < t; k++) m = Math.max(m, f(from + step * k))
        return m
      }
      const edges = [
        best(rowDark, y0, 1),
        best(rowDark, y1, -1),
        best(colDark, x0, 1),
        best(colDark, x1, -1),
      ]
      if (edges.some((e) => e < 0.85)) continue
      const ix0 = x0 + Math.round(w * 0.3)
      const ix1 = x1 - Math.round(w * 0.3)
      const iy0 = y0 + Math.round(h * 0.3)
      const iy1 = y1 - Math.round(h * 0.3)
      let inner = 0
      let innerDark = 0
      for (let y = iy0; y <= iy1; y++) {
        for (let x = ix0; x <= ix1; x++) {
          inner++
          if (black[y * W + x]) innerDark++
        }
      }
      if (inner > 0 && innerDark / inner > 0.5) continue
      filled = false
    }
    const bbox = {
      x: x0 / s,
      y: y0 / (H / page.height),
      width: w / s,
      height: h / (H / page.height),
    }
    boxes.push({ pageIndex: page.pageIndex, bbox, filled, density, char: charUnder(page, bbox) })
  }
  return boxes
}

/** Caractère du texte extrait situé au centre de la case (estimation proportionnelle). */
function charUnder(page: PageData, box: Rect): string | undefined {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  for (const item of page.textItems) {
    const b = item.bbox
    const text = item.text
    if (!text.trim() || cy < b.y || cy > b.y + b.height || cx < b.x || cx > b.x + b.width) continue
    const k = Math.min(
      text.length - 1,
      Math.floor(((cx - b.x) / Math.max(b.width, 1e-6)) * text.length),
    )
    const ch = text[k]!.trim() || text.trim()[0]
    return ch
  }
  return undefined
}

/**
 * Sélection des cases de réponse d'un document : taille proche de celle des cases pleines,
 * hors grilles d'identification (cases portant un chiffre). Le document n'est considéré
 * comme un QCM corrigé que s'il a à la fois des cases pleines et des cases vides.
 */
export function answerBoxes(all: Box[]): Box[] {
  const candidates = all.filter((b) => !isDigit(b.char))
  const empty = candidates.filter((b) => !b.filled)
  if (empty.length === 0) return []
  // Taille de référence : la classe la plus peuplée des contours carrés à centre clair (un
  // glyphe les imite rarement), et non les formes pleines, que le rendu des polices peut
  // produire en nombre (lettres très denses selon le moteur de rendu).
  const side = (b: Box) => (b.bbox.width + b.bbox.height) / 2
  let ref = 0
  let best = 0
  for (const e of empty) {
    const n = empty.filter((o) => Math.abs(side(o) - side(e)) <= 0.15 * side(e)).length
    if (n > best) {
      best = n
      ref = side(e)
    }
  }
  const near = (b: Box) => Math.abs(side(b) - ref) <= 0.2 * ref
  const kept = candidates.filter((b) => near(b) && (!b.filled || b.density >= 0.85))
  if (!kept.some((b) => b.filled) || !kept.some((b) => !b.filled) || kept.length < 3) return []
  return kept
}

const isDigit = (c: string | undefined) => c !== undefined && /^\d$/.test(c)

/**
 * Recentre un emplacement de case supposé (déduit du texte) sur la case réellement dessinée :
 * on cherche, autour du point, deux rangées d'encre de la longueur d'une case séparées d'un
 * côté de case, puis deux colonnes de même. Fonctionne pour une case pleine comme vide.
 * Renvoie le centre trouvé (repère canonique), ou null.
 */
export function locateSquare(
  raster: RasterData,
  page: PageData,
  cx: number,
  cy: number,
  side: number,
): { cx: number; cy: number } | null {
  const { width: W, height: H, rgba } = raster
  const sx = W / page.width
  const sy = H / page.height
  const ink = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false
    const i = (y * W + x) * 4
    return 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]! < 215
  }
  const longest = (cells: boolean[]) => {
    let best = 0
    let run = 0
    for (const c of cells) {
      run = c ? run + 1 : 0
      best = Math.max(best, run)
    }
    return best
  }
  const pick = (lines: number[], length: number, centre: number) => {
    let best: number | null = null
    for (const a of lines) {
      for (const b of lines) {
        const d = b - a
        if (Math.abs(d - length) > Math.max(2, 0.2 * length)) continue
        const mid = (a + b) / 2
        if (best === null || Math.abs(mid - centre) < Math.abs(best - centre)) best = mid
      }
    }
    return best
  }
  const px = cx * sx
  const py = cy * sy
  const sxPx = side * sx
  const syPx = side * sy
  const xs = Math.round(px - 0.8 * sxPx)
  const xe = Math.round(px + 0.8 * sxPx)
  const rows: number[] = []
  for (let y = Math.round(py - 1.2 * syPx); y <= Math.round(py + 1.2 * syPx); y++) {
    const cells: boolean[] = []
    for (let x = xs; x <= xe; x++) cells.push(ink(x, y))
    if (longest(cells) >= 0.75 * sxPx) rows.push(y)
  }
  const my = pick(rows, syPx - 1, py)
  if (my === null) return null
  const ys = Math.round(my - syPx / 2)
  const ye = Math.round(my + syPx / 2)
  const cols: number[] = []
  for (let x = Math.round(px - 1.2 * sxPx); x <= Math.round(px + 1.2 * sxPx); x++) {
    const cells: boolean[] = []
    for (let y = ys; y <= ye; y++) cells.push(ink(x, y))
    if (longest(cells) >= 0.75 * syPx) cols.push(x)
  }
  const mx = pick(cols, sxPx - 1, px)
  if (mx === null) return null
  return { cx: (mx + 0.5) / sx, cy: (my + 0.5) / sy }
}
