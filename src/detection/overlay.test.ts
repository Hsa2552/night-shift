// Corrigé annoté (couche d'annotation aplatie par-dessus le sujet) : pages et observations
// vectorielles SYNTHÉTIQUES.

import { describe, expect, it } from 'vitest'
import type { DetectionResult, PageData, Rect } from './contract.ts'
import { fakePage, fakeRaster } from './fixtures.ts'
import { detectCorrections } from './index.ts'

const lines = [
  '(1) Find the general antiderivative of sin(x).',
  '(A) sin(x) + C',
  '(B) cos(x) + C',
  '(C) -cos(x) + C',
  '(2) Compute the area under the curve.',
]
const top = (n: number) => 300 + n * 16.5
const path = (operatorIndex: number, bbox: Rect) => ({
  region: { pageIndex: 0, bbox },
  operatorIndex,
  visibility: 'unresolved',
  outline: 'affine-envelope' as const,
})

/** Contenu peint aux opérateurs 0 à 4 ; tracés manuscrits à partir de `firstInk`. */
function vectors(page: PageData, firstInk: number) {
  const strokes = Array.from({ length: 12 }, (_, k) =>
    path(firstInk + k, { x: 380 + 12 * k, y: top(4) + 20, width: 10, height: 12 }),
  )
  // Cercle autour de la proposition (C).
  const circle = path(firstInk + 20, { x: 62, y: top(3) - 4, width: 110, height: 19 })
  return {
    pageIndex: 0,
    width: page.width,
    height: page.height,
    rectangles: [],
    textPaint: page.textItems.map((_, operatorIndex) => ({
      operatorIndex,
      mode: 0,
      visibility: 'paint-command',
      glyphCount: 1,
      symbols: {},
      fill: '#000000',
      stroke: null,
      fillOpacity: 1,
      strokeOpacity: 1,
    })),
    textColors: page.textItems.map((item, textIndex) => ({
      textIndex,
      status: 'matched',
      ranges: [
        {
          start: 0,
          end: item.text.length,
          rgb: [0, 0, 0],
          operatorIndices: [textIndex],
          evidence: 'text-and-geometry',
        },
      ],
    })),
    unresolvedPaths: 0,
    unsupportedPathEncoding: 0,
    images: 0,
    graphics: { images: [], rules: [], paths: [...strokes, circle] },
  }
}

const covers = (r: DetectionResult, y: number, x = 100) =>
  r.blocks.some((b) =>
    b.regions.some(
      (g) =>
        x >= g.bbox.x &&
        x <= g.bbox.x + g.bbox.width &&
        y >= g.bbox.y &&
        y <= g.bbox.y + g.bbox.height,
    ),
  )

describe('corrigé annoté par-dessus le sujet', () => {
  it('écriture et réponse entourée masquées ; toutes les propositions masquées à l’identique', async () => {
    const page = fakePage(0, lines, 300)
    const result = await detectCorrections({
      pages: [page],
      getRaster: async () => fakeRaster(page),
      getVectors: async () => vectors(page, 100) as never,
    })
    expect(result.kind).toBe('mixed')
    // Questions visibles.
    expect(covers(result, top(0) + 5)).toBe(false)
    expect(covers(result, top(4) + 5)).toBe(false)
    // Les trois propositions sont masquées (pas seulement l'entourée).
    for (const n of [1, 2, 3]) expect(covers(result, top(n) + 5)).toBe(true)
    // Écriture manuscrite masquée.
    expect(covers(result, top(4) + 26, 420)).toBe(true)
  })

  it('tracés entremêlés au contenu (figure composée) : pas une annotation, rien de masqué', async () => {
    const page = fakePage(0, lines, 300)
    const v = vectors(page, 0) // tracés aux mêmes indices que le texte : pas postérieurs
    v.textPaint.push({ ...v.textPaint[0]!, operatorIndex: 500 })
    const result = await detectCorrections({
      pages: [page],
      getRaster: async () => fakeRaster(page),
      getVectors: async () => v as never,
    })
    expect(result.blocks).toEqual([])
  })
})
