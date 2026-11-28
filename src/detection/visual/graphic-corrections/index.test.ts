import { describe, expect, it } from 'vitest'
import type { VectorPageObservation } from '../../../shared/types'
import { detectGraphicCorrections, type GraphicAnchor } from './index'

const region = (x: number, y: number, width: number, height: number, pageIndex = 0) => ({
  pageIndex,
  bbox: { x, y, width, height },
})
const page = {
  pageIndex: 0,
  width: 200,
  height: 260,
  textItems: [{ text: 'Synthetic', bbox: region(18, 45, 70, 10).bbox }],
}
const vectors: VectorPageObservation = {
  pageIndex: 0,
  width: 200,
  height: 260,
  rectangles: [],
  textPaint: [],
  unresolvedPaths: 0,
  unsupportedPathEncoding: 0,
  images: 1,
  graphics: {
    images: [
      {
        region: region(30, 72, 45, 32),
        kind: 'image',
        visibility: 'paint-command',
        operatorIndex: 1,
      },
    ],
    rules: [],
    paths: [],
  },
}
const anchor: GraphicAnchor = {
  id: 'c1',
  role: 'correction',
  reliability: 'confirmed',
  region: region(18, 45, 70, 10),
  scope: region(15, 40, 120, 85),
  blockId: 'q1',
}

describe('graphic corrections', () => {
  it('uses invariant font size for graphic filtering when C1 text boxes run vertically', () => {
    const rotated = {
      ...page,
      textItems: [
        { text: 'Vertical synthetic label', bbox: region(20, 45, 9, 85).bbox, fontSize: 10 },
      ],
    }
    const result = detectGraphicCorrections({ page: rotated, vectors, anchors: [anchor] })
    expect(result.newBlocks).toHaveLength(1)
    expect(result.candidates[0].masks).toHaveLength(1)
  })

  it('proposes a padded C1 mask attached to an existing correction block', () => {
    const result = detectGraphicCorrections({
      page,
      vectors,
      anchors: [anchor],
      existingBlocks: [{ id: 'q1', regions: [anchor.region] }],
    })
    expect(result.additions).toEqual([
      { blockId: 'q1', regions: [region(29.25, 71.25, 46.5, 33.5)] },
    ])
    expect(result.newBlocks).toEqual([])
    expect(result.candidates[0]).toMatchObject({
      role: 'correction',
      confidence: 'supported',
      visibility: 'declared',
    })
  })

  it('preserves the same geometry under a question scope or a merely adjacent anchor', () => {
    expect(
      detectGraphicCorrections({ page, vectors, anchors: [{ ...anchor, role: 'question' }] })
        .candidates[0].role,
    ).toBe('statement')
    const unknown = detectGraphicCorrections({
      page,
      vectors,
      anchors: [{ ...anchor, scope: undefined }],
    })
    expect(unknown.newBlocks).toEqual([])
    expect(unknown.unresolved[0]).toMatchObject({ role: 'unknown', evidence: ['near-anchor-only'] })
  })

  it('abstains on protected overlaps, padded collisions and competing block ownership', () => {
    const mixed = detectGraphicCorrections({
      page,
      vectors,
      anchors: [anchor],
      protectedRegions: [region(35, 77, 12, 7)],
    })
    expect(mixed.candidates[0]).toMatchObject({
      role: 'mixed',
      contradictions: ['protected-overlap'],
      masks: [],
    })
    const padding = detectGraphicCorrections({
      page,
      vectors,
      anchors: [anchor],
      protectedRegions: [region(75.2, 80, 4, 4)],
    })
    expect(padding.candidates[0].contradictions).toContain('protective-margin-conflict')
    const competing = detectGraphicCorrections({
      page,
      vectors,
      anchors: [anchor, { ...anchor, id: 'c2', blockId: 'q2' }],
    })
    expect(competing.candidates[0].contradictions).toContain('competing-blocks')
    expect(competing.newBlocks).toEqual([])
  })
})
