import { expect, it } from 'vitest'
import { scorePresentedGeo, type GeoTruth } from './geo.ts'
import { scoreStrictGeometry, scoreVisibleInk } from './strict.ts'

it('distingue la couverture du cadre d’une case et l’encre encore visible', async () => {
  const truth: GeoTruth = {
    format: 'unspoil-verite-geo/1',
    provenance: 'exemple synthétique',
    kind: 'mixed',
    elements: [
      { page: 0, role: 'c', bbox: [0, 0, 25, 10], group: 'q1', category: 'empty-box' },
      { page: 0, role: 'c', bbox: [25, 0, 25, 10], group: 'q1', category: 'filled-box' },
      { page: 0, role: 'q', bbox: [0, 10, 50, 10], category: 'text' },
    ],
  }
  const blocks = [
    {
      id: 'q1',
      regions: [
        { pageIndex: 0, bbox: { x: 0, y: 0, width: 24, height: 10 } },
        { pageIndex: 0, bbox: { x: 25, y: 0, width: 25, height: 6 } },
        { pageIndex: 0, bbox: { x: 25, y: 6, width: 25, height: 4 } },
      ],
    },
  ]
  expect(scoreStrictGeometry(truth, blocks)).toEqual({
    corrections: { 'empty-box': { total: 1, full: 0 }, 'filled-box': { total: 1, full: 1 } },
    statements: { total: 1, preserved: 1 },
    indirect: { qcmGroupsAnnotated: 1, groupsAtRisk: 1, groupsWithGeometryCue: 0 },
  })
  const rgba = new Uint8ClampedArray(50 * 20 * 4).fill(255)
  for (const pixel of [24, 49, 51, 600]) rgba[pixel * 4] = 0
  const ink = await scoreVisibleInk(
    truth,
    blocks,
    [{ pageIndex: 0, width: 50, height: 20 }],
    async () => ({ width: 50, height: 20, rgba }),
  )
  expect(ink.corrections['empty-box']).toEqual({ withInk: 1, withVisibleInk: 1, noInk: 0 })
  expect(ink.corrections['filled-box']).toEqual({ withInk: 1, withVisibleInk: 0, noInk: 0 })
  expect(ink.statements).toEqual({ withInk: 1, withMaskedInk: 0, noInk: 0 })
})

it('signale une différence de forme associée à l’état malgré deux cases entièrement couvertes', () => {
  const truth: GeoTruth = {
    format: 'unspoil-verite-geo/1',
    provenance: 'exemple synthétique',
    kind: 'mixed',
    elements: [
      { page: 0, role: 'c', bbox: [10, 10, 10, 10], category: 'empty-box', group: 'q1' },
      { page: 0, role: 'c', bbox: [10, 30, 10, 10], category: 'filled-box', group: 'q1' },
    ],
  }
  const blocks = [
    {
      id: 'question',
      regions: [
        { pageIndex: 0, bbox: { x: 10, y: 10, width: 10, height: 10 } },
        { pageIndex: 0, bbox: { x: 8, y: 28, width: 16, height: 14 } },
      ],
    },
  ]
  const scored = scorePresentedGeo(truth, { kind: 'automatic', blocks })
  expect(scored.success).toBe(true)
  expect(scored.strictSuccess).toBe(false)
  expect(scored.coverage?.strict.indirect).toEqual({
    qcmGroupsAnnotated: 1,
    groupsAtRisk: 1,
    groupsWithGeometryCue: 1,
  })
})
