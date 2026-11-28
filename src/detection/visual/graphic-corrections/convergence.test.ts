import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakePage } from '../../fixtures'
import { detectCorrections } from '../../index'
import type { VectorPageObservation } from '../../../shared/types'
import { fuseGraphicCorrections } from './convergence'
import * as graphics from './index'

const page = fakePage(0, [
  '1. Calculer 2 + 2.',
  'Correction : 2 + 2 = 4.',
  'On détaille la solution.',
  '2. Calculer 3 × 3.',
  'Correction : 3 × 3 = 9.',
])
const vectors: VectorPageObservation = {
  ...page,
  rectangles: [],
  textPaint: [],
  unresolvedPaths: 0,
  unsupportedPathEncoding: 0,
  images: 1,
  graphics: {
    images: [
      {
        region: { pageIndex: 0, bbox: { x: 300, y: 90, width: 40, height: 22 } },
        operatorIndex: 1,
        kind: 'image',
        visibility: 'paint-command',
      },
    ],
    paths: [],
    rules: [],
  },
}

afterEach(() => vi.restoreAllMocks())

describe('convergence graphique', () => {
  it('transmet les observations et protège les énoncés sans élargir les blocs confirmés', async () => {
    const historical = await detectCorrections({ pages: [page] })
    const detector = vi.spyOn(graphics, 'detectGraphicCorrections')
    const result = await detectCorrections({ pages: [page], getVectors: async () => vectors })
    expect(historical.blocks).toHaveLength(2)
    expect(detector).toHaveBeenCalledOnce()
    const input = detector.mock.calls[0]![0]
    expect(input.vectors).toBe(vectors)
    expect(input.existingBlocks).toEqual(historical.blocks)
    expect(input.anchors).toHaveLength(2)
    expect(input.anchors.every((anchor) => anchor.role === 'question' && !anchor.scope)).toBe(true)
    expect(input.protectedRegions?.map(({ bbox }) => bbox)).toEqual([
      page.textItems[0]!.bbox,
      page.textItems[3]!.bbox,
    ])
    expect(result).toEqual(historical)
  })

  it('écarte les pages qui contiennent les masques spécialisés du QCM', async () => {
    const historical = await detectCorrections({ pages: [page] })
    const getVectors = vi.fn().mockResolvedValue(vectors)
    await fuseGraphicCorrections(
      { pages: [page], getVectors },
      historical.blocks,
      [],
      [],
      new Set([0]),
    )
    expect(getVectors).not.toHaveBeenCalled()
  })

  it('préserve le résultat déterminé si le sous-détecteur optionnel échoue', async () => {
    const historical = await detectCorrections({ pages: [page] })
    const detector = vi.spyOn(graphics, 'detectGraphicCorrections').mockImplementation(() => {
      throw new Error('Figure non interprétable')
    })
    expect(await detectCorrections({ pages: [page], getVectors: async () => vectors })).toEqual(
      historical,
    )
    expect(detector).toHaveBeenCalledOnce()
  })
})
