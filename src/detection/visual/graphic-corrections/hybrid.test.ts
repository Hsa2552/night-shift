import { expect, it } from 'vitest'
import type { PageData, RasterData, Rect, VectorPageObservation } from '../../../shared/types'
import { observeGraphicFrames } from './frames'
import { reconstructAdaptiveLayout } from './adaptive-layout'
import { detectGraphicCorrections, type GraphicAnchor } from './index'
import { overlap } from './geometry'
import { locateRuledRegions, type Separator } from './closed-rules'

const bbox = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
})
const region = (box: Rect) => ({ pageIndex: 0, bbox: box })
const page: PageData = {
  pageIndex: 0,
  width: 240,
  height: 240,
  textItems: [
    { text: 'left', bbox: bbox(25, 31, 20, 8) },
    { text: 'right', bbox: bbox(66, 31, 20, 8) },
    { text: 'merged', bbox: bbox(38, 67, 31, 8) },
  ],
}

it('keeps nested frames separate and leaves open figures as uncertified layouts', () => {
  function frame(x: number, y: number, width: number, height: number): Separator[] {
    return [
      { orientation: 'h', box: [x, y, x + width, y + 1] },
      { orientation: 'h', box: [x, y + height, x + width, y + height + 1] },
      { orientation: 'v', box: [x, y, x + 1, y + height] },
      { orientation: 'v', box: [x + width, y, x + width + 1, y + height] },
    ]
  }
  expect(locateRuledRegions([...frame(10, 10, 160, 90), ...frame(41, 33, 60, 30)], 8)).toHaveLength(
    2,
  )
  expect(locateRuledRegions(frame(10, 10, 160, 90).slice(1, 3), 8)).toEqual([])
})

it('retains short labels on a confirmed graphic edge and leaves unrelated prose untouched', () => {
  const image = raster()
  image.fill(bbox(30, 80, 35, 30), [0, 0, 0])
  const label = bbox(69, 87, 21, 8)
  const prose = bbox(27, 112, 100, 8)
  const annotated: PageData = {
    ...page,
    textItems: [
      ...page.textItems,
      { text: '5 N', bbox: label },
      { text: 'Detailed explanation outside the drawing', bbox: prose },
    ],
  }
  const correction: GraphicAnchor = {
    id: 'c',
    role: 'correction',
    reliability: 'confirmed',
    region: region(bbox(20, 71, 22, 7)),
    scope: region(bbox(19, 68, 150, 75)),
  }
  const result = detectGraphicCorrections({ page: annotated, raster: image, anchors: [correction] })
  expect(
    result.candidates.some(
      (c) => c.kind === 'label' && c.region.bbox.x === label.x && c.masks.length,
    ),
  ).toBe(true)
  expect(
    result.candidates.some((c) => c.kind === 'label' && overlap(c.region.bbox, prose) > 0),
  ).toBe(false)
  const protectedResult = detectGraphicCorrections({
    page: annotated,
    raster: image,
    anchors: [correction],
    protectedRegions: [region(label)],
  })
  expect(protectedResult.candidates.some((c) => c.kind === 'label' && c.masks.length)).toBe(false)
})

function raster(scale = 1): RasterData & { fill: (box: Rect, rgb: number[]) => void } {
  const width = page.width * scale,
    height = page.height * scale
  const rgba = new Uint8ClampedArray(width * height * 4).fill(255)
  return {
    width,
    height,
    rgba,
    fill(box, rgb) {
      for (let y = Math.floor(box.y * scale); y < (box.y + box.height) * scale; y++)
        for (let x = Math.floor(box.x * scale); x < (box.x + box.width) * scale; x++)
          rgba.set(rgb, (y * width + x) * 4)
    },
  }
}

it('handles only verified correction paint in a mixed figure across color changes and raster resolutions', () => {
  for (const scale of [1, 2])
    for (const correctionRgb of [
      [190, 0, 112],
      [0, 80, 200],
    ] as [number, number, number][]) {
      const image = raster(scale)
      const protectedBox = bbox(59, 112, 67, 4)
      image.fill(protectedBox, [0, 0, 0])
      image.fill(bbox(65, 91, 24, 4), correctionRgb)
      image.fill(bbox(90, 100, 14, 4), correctionRgb)
      const result = detectGraphicCorrections({
        page,
        raster: image,
        anchors: [],
        mixedFigures: [
          { region: region(bbox(45, 82, 99, 52)), blockId: 'solution', correctionRgb },
        ],
        protectedRegions: [region(protectedBox)],
      })
      expect(result.newBlocks).toHaveLength(1)
      const boxes = result.newBlocks[0].regions
      expect(boxes).toHaveLength(2)
      expect(boxes.every((r) => overlap(r.bbox, protectedBox) === 0)).toBe(true)
      expect(
        result.candidates.some((c) =>
          c.evidence.includes('declared-local-paint-confirmed-by-raster'),
        ),
      ).toBe(true)
    }
})

it('keeps a mixed overlap unresolved and refuses a margin that erases reference paint', () => {
  const image = raster()
  image.fill(bbox(65, 91, 24, 4), [190, 0, 112])
  image.fill(bbox(120, 101, 13, 4), [190, 0, 112])
  const result = detectGraphicCorrections({
    page,
    raster: image,
    anchors: [],
    mixedFigures: [
      { region: region(bbox(45, 82, 99, 52)), blockId: 'solution', correctionRgb: [190, 0, 112] },
    ],
    protectedRegions: [region(bbox(70, 93, 30, 4))],
  })
  expect(result.newBlocks).toEqual([])
  expect(result.unresolved.some((c) => c.contradictions.includes('protected-overlap'))).toBe(true)
  expect(result.unresolved.some((c) => c.contradictions.includes('mixed-paint-incomplete'))).toBe(
    true,
  )
})

it('exposes a merged cell only where the internal separator does not cross the row', () => {
  const vectors: VectorPageObservation = {
    pageIndex: 0,
    width: 240,
    height: 240,
    images: 0,
    unresolvedPaths: 0,
    unsupportedPathEncoding: 0,
    rectangles: [],
    textPaint: [],
    graphics: {
      images: [],
      paths: [],
      rules: [
        ...[20, 54, 96].map((y, operatorIndex) => ({
          orientation: 'h' as const,
          region: region(bbox(12, y, 90, 1)),
          visibility: 'paint-command' as const,
          source: 'stroke' as const,
          operatorIndex,
        })),
        ...[12, 102, 55].map((x, i) => ({
          orientation: 'v' as const,
          region: region(bbox(x, 20, 1, i === 2 ? 34 : 76)),
          visibility: 'paint-command' as const,
          source: 'stroke' as const,
          operatorIndex: i + 4,
        })),
      ],
    },
  }
  const frames = observeGraphicFrames(page, reconstructAdaptiveLayout(page), vectors)
  expect(frames[0].sources).toEqual(['native'])
  expect(frames[0].cells.map((c) => [c.merged, c.fragmentIndices])).toEqual([
    [false, [0]],
    [false, [1]],
    [true, [2]],
  ])
})

it('uses complementary raster and native separators to close a partial frame', () => {
  const vectors: VectorPageObservation = {
    pageIndex: 0,
    width: 240,
    height: 240,
    images: 0,
    unresolvedPaths: 0,
    unsupportedPathEncoding: 0,
    rectangles: [],
    textPaint: [],
    graphics: {
      images: [],
      paths: [],
      rules: [20, 105].map((y, operatorIndex) => ({
        orientation: 'h',
        region: region(bbox(12, y, 100, 1)),
        visibility: 'paint-command',
        source: 'stroke',
        operatorIndex,
      })),
    },
  }
  const image = raster()
  for (const x of [12, 111]) image.fill(bbox(x, 20, 1, 86), [0, 0, 0])
  const anchor: GraphicAnchor = {
    id: 'solution',
    blockId: 'solution',
    role: 'correction',
    reliability: 'confirmed',
    region: region(bbox(10, 8, 105, 8)),
    scope: region(bbox(8, 7, 112, 105)),
  }
  const hybrid = detectGraphicCorrections({ page, vectors, raster: image, anchors: [anchor] })
  expect(hybrid.frames.find((f) => f.kind === 'closed-rules')?.sources).toEqual([
    'native',
    'raster',
  ])
  expect(
    detectGraphicCorrections({ page, vectors, anchors: [anchor] }).frames.some(
      (f) => f.kind === 'closed-rules',
    ),
  ).toBe(false)
})
