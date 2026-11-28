import { describe, expect, it } from 'vitest'
import type { DetectionResult } from '../contract.ts'
import { scoreGeo, scorePresentedGeo, type GeoTruth } from './geo.ts'

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
const pages = [{ pageIndex: 0, width: 595, height: 842 }]
const full = [block('c1', 0, 118, 595, 14), block('c2', 0, 138, 595, 14)]

describe('scoreGeo', () => {
  it('une correction dont seul le centre est couvert est partielle, pas masquée', () => {
    const s = scoreGeo(truth, result([block('c1', 200, 118, 40, 14), full[1]!]), pages)
    expect(s.corrections).toEqual({ total: 2, full: 1, partial: 1, none: 0 })
    expect(s.success).toBe(false)
  })

  it('réussite : corrections entières, énoncé visible, blocs indépendants', () => {
    const s = scoreGeo(truth, result(full), pages)
    expect(s.success).toBe(true)
    expect(s.blocks).toEqual({ total: 2, fullyMasked: 2, independent: 2 })
  })

  it('un bloc unique couvrant deux blocs attendus : masqués mais pas indépendants', () => {
    const s = scoreGeo(truth, result([block('c1', 0, 118, 595, 34)]), pages)
    expect(s.blocks).toEqual({ total: 2, fullyMasked: 2, independent: 0 })
  })

  it('« sujet seul » obtenu alors qu’il y a des corrections : échec, même sans masque', () => {
    const s = scoreGeo(truth, { ...result([]), kind: 'statement_only' }, pages)
    expect(s.success).toBe(false)
    expect(s.corrections.none).toBe(2)
  })

  it.each([
    { ...result(full), kind: 'unknown' as const },
    { ...result(full), needsFallback: true },
    { ...result(full), kind: 'statement_only' as const },
    result([...full, block('off-page', 700, 10, 25, 25)]),
    result([...full, full[0]!]),
  ])('garde le score brut quand le parcours bascule en lecture progressive', (detection) => {
    const score = scoreGeo(truth, detection, pages)
    expect(score.corrections.full).toBe(2)
    expect(score.abstained).toBe(true)
    expect(score.presentation).toMatchObject({
      mode: 'progressive',
      success: false,
      coverage: null,
    })
  })

  it('abstention si aucun masque ne peut être appliqué sur un document corrigé', () => {
    expect(scoreGeo(truth, result([]), pages).presentation).toMatchObject({
      mode: 'progressive',
      reason: 'invalid-masks',
    })
  })

  it('distingue un sujet seul correctement présenté et une erreur de traitement', () => {
    const subject: GeoTruth = { ...truth, kind: 'statement_only', elements: [truth.elements[0]!] }
    const score = scoreGeo(subject, { ...result([]), kind: 'statement_only' }, pages)
    expect(score.presentation).toMatchObject({ mode: 'statement_only', success: true })
    expect(scorePresentedGeo(subject, { kind: 'error' })).toEqual({
      mode: 'error',
      coverage: null,
      success: false,
      strictSuccess: false,
    })
  })
})
