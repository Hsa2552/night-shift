// Analyse visuelle : couleur de l'encre d'une ligne, à partir du rendu raster de la page.
// Sert à reconnaître les corrigés écrits dans une couleur distincte, sans marqueur textuel.
// La couleur est un indice, jamais une preuve : voir les conditions dans engine.ts.

import type { RasterData, Rect } from './contract.ts'

export type Ink = { kind: 'none' } | { kind: 'dark' } | { kind: 'color'; hue: number }

const MAX_SAMPLES = 4000

/** Couleur dominante de l'encre dans un rectangle (repère canonique de la page). */
export function inkOf(raster: RasterData, pageWidth: number, pageHeight: number, bbox: Rect): Ink {
  const sx = raster.width / pageWidth
  const sy = raster.height / pageHeight
  const x0 = Math.max(0, Math.floor(bbox.x * sx))
  const y0 = Math.max(0, Math.floor(bbox.y * sy))
  const x1 = Math.min(raster.width, Math.ceil((bbox.x + bbox.width) * sx))
  const y1 = Math.min(raster.height, Math.ceil((bbox.y + bbox.height) * sy))
  const area = Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
  if (area === 0) return { kind: 'none' }
  const step = Math.max(1, Math.floor(Math.sqrt(area / MAX_SAMPLES)))

  let ink = 0
  let colored = 0
  let hx = 0
  let hy = 0
  const { rgba, width } = raster
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const i = (y * width + x) * 4
      if (rgba[i + 3]! < 128) continue
      const r = rgba[i]!
      const g = rgba[i + 1]!
      const b = rgba[i + 2]!
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      if (lum > 200 && max - min < 40) continue // fond clair
      ink++
      if (max - min >= 60) {
        colored++
        const h = hue(r, g, b, max, min)
        hx += Math.cos(h)
        hy += Math.sin(h)
      }
    }
  }
  if (ink < 4) return { kind: 'none' }
  if (colored / ink < 0.5) return { kind: 'dark' }
  const deg = (Math.atan2(hy, hx) * 180) / Math.PI
  return { kind: 'color', hue: (deg + 360) % 360 }
}

/** Teinte en radians. */
function hue(r: number, g: number, b: number, max: number, min: number): number {
  const d = max - min
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return (h * Math.PI) / 3
}

/** Distance angulaire entre deux teintes, en degrés. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}
