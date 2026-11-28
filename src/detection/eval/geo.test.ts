import { describe, expect, it } from 'vitest'
import type { DetectionResult } from '../contract.ts'
import { scoreGeo, type GeoTruth } from './geo.ts'

const truth: GeoTruth = {
  format: 'unspoil-verite-geo/1',
  provenance: 'test synthétique',
  kind: 'mixed',
  elements: [
    { page: 0, role: 'q', bbox: [72, 100, 300, 10] },
    { page: 0, role: 'c', bbox: [72, 120, 300, 10], group: 'b1' },
    { page: 0, role: 'c', bbox: [72, 140, 300, 10], group: 'b2' },
  ],
}
const block = (id: string, x: number, y: number, w: number, h: number) => ({
  id,
  regions: [{ pageIndex: 0, bbox: { x, y, width: w, height: h } }],
})
const result = (blocks: DetectionResult['blocks']): DetectionResult => ({
  kind: 'mixed',
  blocks,
  warnings: [],
  needsFallback: false,
})

describe('scoreGeo', () => {
  it('une correction dont seul le centre est couvert est partielle, pas masquée', () => {
    const s = scoreGeo(truth, result([block('c1', 200, 118, 40, 14), block('c2', 0, 138, 595, 14)]))
    expect(s.corrections).toEqual({ total: 2, full: 1, partial: 1, none: 0 })
    expect(s.success).toBe(false)
  })

  it('réussite : corrections entières, énoncé visible, blocs indépendants', () => {
    const s = scoreGeo(truth, result([block('c1', 0, 118, 595, 14), block('c2', 0, 138, 595, 14)]))
    expect(s.success).toBe(true)
    expect(s.blocks).toEqual({ total: 2, fullyMasked: 2, independent: 2 })
  })

  it('un bloc unique couvrant deux blocs attendus : masqués mais pas indépendants', () => {
    const s = scoreGeo(truth, result([block('c1', 0, 118, 595, 34)]))
    expect(s.blocks).toEqual({ total: 2, fullyMasked: 2, independent: 0 })
  })

  it('« sujet seul » obtenu alors qu’il y a des corrections : échec, même sans masque', () => {
    const s = scoreGeo(truth, { ...result([]), kind: 'statement_only' })
    expect(s.success).toBe(false)
    expect(s.corrections.none).toBe(2)
  })
})
