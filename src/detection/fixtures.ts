// Générateur de pages SYNTHÉTIQUES pour les tests (données fictives, pas de vrai PDF).
// Chaque ligne devient un TextItem dont la largeur est estimée à 0,5 × taille × nombre
// de caractères, comme une police proportionnelle moyenne.

import type { PageData, TextItem } from './contract.ts'

export const A4 = { width: 595, height: 842 }

export interface FakeLine {
  text: string
  /** Abscisse du début de la ligne (72 par défaut, marge gauche). */
  x?: number
  /** Ordonnée du haut de la ligne. Si absente : ligne suivante, interligne de 1,5 × taille. */
  y?: number
  size?: number
  font?: string
}

export function fakeItem(
  text: string,
  x: number,
  y: number,
  size = 11,
  font = 'Helvetica',
): TextItem {
  return {
    text,
    bbox: { x, y, width: text.length * size * 0.5, height: size },
    fontSize: size,
    fontName: font,
  }
}

/** Page synthétique : chaque entrée est une ligne (chaîne ou description détaillée). */
export function fakePage(pageIndex: number, lines: (string | FakeLine)[], startY = 72): PageData {
  let y = startY
  const textItems: TextItem[] = []
  for (const entry of lines) {
    const line = typeof entry === 'string' ? { text: entry } : entry
    const size = line.size ?? 11
    const top = line.y ?? y
    if (line.text !== '') textItems.push(fakeItem(line.text, line.x ?? 72, top, size, line.font))
    y = top + size * 1.5
  }
  return { pageIndex, ...A4, textItems }
}

/** Page sans aucun texte extractible (document scanné). */
export function blankPage(pageIndex: number): PageData {
  return { pageIndex, ...A4, textItems: [] }
}

export type RGB = [number, number, number]

/**
 * Rendu raster SYNTHÉTIQUE d'une page : fond blanc, et chaque fragment de texte peint
 * comme un rectangle plein de sa couleur (noir par défaut). Échelle 1 pixel par unité.
 */
export function fakeRaster(
  page: PageData,
  colorOf: (item: TextItem) => RGB | undefined = () => undefined,
) {
  const width = Math.ceil(page.width)
  const height = Math.ceil(page.height)
  const rgba = new Uint8ClampedArray(width * height * 4).fill(255)
  for (const item of page.textItems) {
    const [r, g, b] = colorOf(item) ?? [0, 0, 0]
    const { x, y, width: w, height: h } = item.bbox
    for (let py = Math.floor(y); py < Math.min(height, Math.ceil(y + h)); py++) {
      for (let px = Math.floor(x); px < Math.min(width, Math.ceil(x + w)); px++) {
        const i = (py * width + px) * 4
        rgba[i] = r
        rgba[i + 1] = g
        rgba[i + 2] = b
      }
    }
  }
  return { width, height, rgba }
}
