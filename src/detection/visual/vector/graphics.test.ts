import { OPS } from 'pdfjs-dist'
import { expect, it } from 'vitest'
import { highlightRegions } from './graphics'
import { readVectorOperators } from './index'

const page = { pageIndex: 0, width: 175, height: 190 }
const view = [0, 1, 1, 0, -5, -10] as const

it('observes image placements, a transformed separator and an envelope for a figure', () => {
  const source = readVectorOperators(
    page,
    view,
    {
      fnArray: [
        OPS.save,
        OPS.transform,
        OPS.paintImageXObjectRepeat,
        OPS.restore,
        OPS.setLineWidth,
        OPS.constructPath,
        OPS.setFillRGBColor,
        OPS.constructPath,
      ],
      argsArray: [
        [],
        [2, 0, 0, 2, 30, 40],
        ['image', 10, 5, new Float32Array([0, 0, 12, 7])],
        [],
        [0.8],
        [OPS.stroke, [new Float32Array([0, 20, 50, 1, 70, 50])], [20, 50, 70, 50]],
        ['#abcdef'],
        [OPS.fill, [new Float32Array([0, 60, 80, 2, 64, 90, 86, 94, 90, 96, 4])], [60, 80, 90, 96]],
      ],
    },
    { getFont: () => undefined, onGlyph: () => undefined },
  )
  expect(source.images).toBe(1)
  expect(source.graphics?.images.map(({ kind, region }) => [kind, region.bbox])).toEqual([
    ['image', { x: 35, y: 20, width: 10, height: 20 }],
    ['image', { x: 49, y: 44, width: 10, height: 20 }],
  ])
  expect(source.graphics?.rules).toContainEqual(
    expect.objectContaining({
      orientation: 'v',
      source: 'stroke',
      visibility: 'paint-command',
    }),
  )
  expect(source.graphics?.paths).toContainEqual(
    expect.objectContaining({
      region: { pageIndex: 0, bbox: { x: 75, y: 50, width: 16, height: 30 } },
      outline: 'affine-envelope',
      fill: [171, 205, 239],
    }),
  )
})

it('observes individual highlight quads and skips hidden annotations', () => {
  const seen = highlightRegions(
    [
      {
        subtype: 'Highlight',
        rect: [15, 10, 35, 25],
        color: new Uint8ClampedArray([255, 255, 0]),
        quadPoints: new Float32Array([
          15, 18, 30, 18, 15, 10, 30, 10, 20, 25, 35, 25, 20, 20, 35, 20,
        ]),
      },
      { subtype: 'Highlight', annotationFlags: 2, rect: [40, 10, 70, 18] },
      { subtype: 'Underline', rect: [40, 10, 70, 18] },
    ],
    page,
    view,
  )
  expect(seen).toEqual([
    {
      region: { pageIndex: 0, bbox: { x: 5, y: 5, width: 8, height: 15 } },
      geometry: 'annotation-quad',
      rgb: [255, 255, 0],
    },
    {
      region: { pageIndex: 0, bbox: { x: 15, y: 10, width: 5, height: 15 } },
      geometry: 'annotation-quad',
      rgb: [255, 255, 0],
    },
  ])
})
