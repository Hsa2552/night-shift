import { OPS } from 'pdfjs-dist'
import { expect, it } from 'vitest'
import { readVectorOperators } from './index'
import { nativeSquares } from './cases'
import { identity } from './geometry'

const page = { pageIndex: 0, width: 120, height: 80 }
const rect = (x: number, y: number, w = 5) => [
  new Float32Array([0, x, y, 1, x + w, y, 1, x + w, y + w, 1, x, y + w, 4]),
]
const evaluate = (
  instructions: [number, ...unknown[]][],
  viewport: Parameters<typeof readVectorOperators>[1] = identity,
) =>
  readVectorOperators(page, viewport, {
    fnArray: instructions.map(([op]) => op),
    argsArray: instructions.map(([, ...args]) => args),
  })

it('reconstructs rectangles under the rotated viewport, a transform, and a nested form', () => {
  const source = evaluate(
    [
      [OPS.save],
      [OPS.transform, 1, 0, 0, 1, 30, 20],
      [OPS.paintFormXObjectBegin, [2, 0, 0, 2, 5, 7], [-100, -100, 100, 100]],
      [OPS.setFillRGBColor, '#ffffff'],
      [OPS.constructPath, OPS.fill, rect(1, 2)],
      [OPS.paintFormXObjectEnd],
      [OPS.constructPath, OPS.fill, rect(1, 2)],
      [OPS.restore],
    ],
    [0, 1, 1, 0, -5, -10],
  )
  expect(source.rectangles).toEqual([
    {
      region: { pageIndex: 0, bbox: { x: 26, y: 27, width: 10, height: 10 } },
      operatorIndex: 4,
      fill: '#ffffff',
      fillOpacity: 1,
      visibility: 'paint-command',
    },
    {
      region: { pageIndex: 0, bbox: { x: 17, y: 21, width: 5, height: 5 } },
      operatorIndex: 6,
      fill: '#000000',
      fillOpacity: 1,
      visibility: 'paint-command',
    },
  ])
})

it('keeps invisible, clipped and optional paint separate from plain commands', () => {
  const source = evaluate([
    [OPS.save],
    [OPS.setGState, [['ca', 0]]],
    [OPS.constructPath, OPS.fill, rect(2, 2)],
    [OPS.restore],
    [OPS.clip],
    [OPS.constructPath, OPS.endPath, rect(0, 0, 12)],
    [OPS.constructPath, OPS.fill, rect(14, 14)],
    [OPS.beginMarkedContentProps, 'OC', { id: '1' }],
    [OPS.constructPath, OPS.fill, rect(2, 2)],
    [OPS.endMarkedContent],
    [OPS.constructPath, OPS.fill, [null], [0, 0, 2, 2]],
  ])
  expect(source.rectangles.map(({ visibility }) => visibility)).toEqual([
    'invisible',
    'clipped',
    'unresolved',
  ])
  expect(source.unsupportedPathEncoding).toBe(1)
})

it('records text paint and a known origin without inventing advances or exposing characters', () => {
  const source = evaluate([
    [OPS.setFillRGBColor, '#0012ff'],
    [OPS.beginText],
    [OPS.setFont, 'font7', 12],
    [OPS.moveText, 5, 12],
    [OPS.showText, [{ unicode: 'A' }, -6, { unicode: '☑' }]],
    [OPS.setTextRenderingMode, 3],
    [OPS.showText, [{ unicode: 'C' }]],
  ])
  expect(source.textPaint[0]).toMatchObject({
    glyphCount: 2,
    symbols: { 'marked-square': 1 },
    origin: [5, 12],
    fill: '#0012ff',
    font: 'font7',
    size: 12,
    visibility: 'paint-command',
  })
  expect(source.textPaint[1].origin).toBeUndefined()
  expect(source.textPaint[1].visibility).toBe('invisible')
  expect(JSON.stringify(source)).not.toContain('unicode')
})

it('preserves independent paint observations on different pages', () => {
  const result = evaluate([
    [OPS.setFillRGBColor, '#ffffff'],
    [OPS.constructPath, OPS.fill, rect(2, 2)],
  ]).rectangles[0]
  const next = { ...result, region: { ...result.region, pageIndex: 1 }, fill: '#000000' }
  const squares = nativeSquares([result, next])
  expect(
    squares.map(({ region, nativeState, needsVisibilityCheck }) => [
      region.pageIndex,
      nativeState,
      needsVisibilityCheck,
    ]),
  ).toEqual([
    [0, 'empty', true],
    [1, 'filled', true],
  ])
})

it('treats overlapping fill contours as unresolved and keeps separate rectangles usable', () => {
  const compound = [
    new Float32Array([...rect(2, 2, 12)[0], ...rect(4, 4, 4)[0], ...rect(30, 30)[0]]),
  ]
  const source = evaluate([[OPS.constructPath, OPS.eoFill, compound]])
  expect(source.unresolvedPaths).toBe(1)
  expect(source.rectangles.map(({ visibility }) => visibility)).toEqual([
    'unresolved',
    'unresolved',
    'paint-command',
  ])
})
