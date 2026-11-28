import { OPS } from 'pdfjs-dist'
import type { PageDimensions, PageRegion, Rect } from '../../../shared/types'
import {
  compose,
  extent,
  formBounds,
  matrix,
  numbers,
  point,
  type Matrix,
  type Point,
} from './geometry'
import type { Visibility } from './index'
import { parseRgb, type NativeRgb } from './text-colors'

interface Position {
  region: PageRegion
  operatorIndex: number
  visibility: Visibility
}

export interface ImagePlacement extends Position {
  kind: 'image' | 'mask'
}

export interface VectorRule extends Position {
  orientation: 'h' | 'v'
  source: 'stroke' | 'fill'
}

export interface PathRegion extends Position {
  outline: 'rectangles' | 'affine-envelope'
  fill?: NativeRgb
  stroke?: NativeRgb
}

export interface NativeGraphics {
  images: ImagePlacement[]
  rules: VectorRule[]
  paths: PathRegion[]
  highlights?: HighlightRegion[]
}

export interface HighlightRegion {
  region: PageRegion
  geometry: 'annotation-quad' | 'annotation-rect'
  rgb?: NativeRgb
}

interface AnnotationGeometry {
  subtype?: string
  annotationFlags?: number
  rect?: number[]
  quadPoints?: Float32Array | number[]
  color?: Uint8ClampedArray | Uint8Array | number[]
}

export function highlightRegions(
  annotations: readonly unknown[],
  page: PageDimensions,
  viewport: Matrix,
): HighlightRegion[] {
  const output: HighlightRegion[] = []
  for (const entry of annotations) {
    if (!entry || typeof entry !== 'object') continue
    const { subtype, annotationFlags, rect, quadPoints, color } = entry as AnnotationGeometry
    // PDF annotation flags Hidden and NoView suppress a highlight in the display intent.
    if (subtype !== 'Highlight' || (annotationFlags ?? 0) & 0x22) continue
    const rgb =
      color &&
      color.length === 3 &&
      Array.from(color).every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
        ? (Array.from(color) as NativeRgb)
        : undefined
    const quads = numbers(quadPoints)
    if (quads && quads.length >= 8 && quads.length % 8 === 0) {
      for (let i = 0; i < quads.length; i += 8) {
        const points: Point[] = []
        for (let j = i; j < i + 8; j += 2) points.push(point(viewport, quads[j], quads[j + 1]))
        const bbox = extent(points)
        if (bbox.width > 0 && bbox.height > 0 && Object.values(bbox).every(Number.isFinite))
          output.push({
            region: { pageIndex: page.pageIndex, bbox },
            geometry: 'annotation-quad',
            rgb,
          })
      }
    } else {
      const bbox = formBounds(rect, viewport)
      if (bbox && bbox.width > 0 && bbox.height > 0)
        output.push({
          region: { pageIndex: page.pageIndex, bbox },
          geometry: 'annotation-rect',
          rgb,
        })
    }
  }
  return output
}

interface Context {
  transform: Matrix
  pageIndex: number
  operatorIndex: number
  visibility: (bounds: Rect, opacity: number) => Visibility
}

const asNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
const normalImages = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject])
const normalMasks = new Set([OPS.paintImageMaskXObject, OPS.paintSolidColorImageMask])

export function recordImages(
  graphics: NativeGraphics,
  context: Context,
  op: number,
  args: unknown[],
  alpha: number,
) {
  function add(kind: ImagePlacement['kind'], matrix?: Matrix) {
    const transform = matrix ? compose(context.transform, matrix) : context.transform
    const bounds = formBounds([0, 0, 1, 1], transform)
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return
    graphics.images.push({ ...position(context, bounds, alpha), kind })
  }
  if (normalImages.has(op)) add('image')
  if (normalMasks.has(op)) add('mask')

  if (op === OPS.paintInlineImageXObjectGroup || op === OPS.paintImageMaskXObjectGroup) {
    const imageGroup = args[op === OPS.paintInlineImageXObjectGroup ? 1 : 0]
    if (!Array.isArray(imageGroup)) return
    for (const entry of imageGroup) {
      const transform = matrix(entry?.transform)
      if (transform) add(op === OPS.paintInlineImageXObjectGroup ? 'image' : 'mask', transform)
    }
  }
  if (op === OPS.paintImageXObjectRepeat || op === OPS.paintImageMaskXObjectRepeat) {
    const mask = op === OPS.paintImageMaskXObjectRepeat
    const a = asNumber(args[1])
    const b = mask ? asNumber(args[2]) : 0
    const c = mask ? asNumber(args[3]) : 0
    const d = asNumber(args[mask ? 4 : 2])
    const pairs = numbers(args[mask ? 5 : 3])
    if (a === undefined || b === undefined || c === undefined || d === undefined || !pairs) return
    for (let i = 0; i + 1 < pairs.length; i += 2) {
      const e = pairs[i]
      const f = pairs[i + 1]
      if (Number.isFinite(e) && Number.isFinite(f)) add(mask ? 'mask' : 'image', [a, b, c, d, e, f])
    }
  }
}

function position(context: Context, bbox: Rect, opacity: number): Position {
  const { operatorIndex, pageIndex } = context
  return {
    region: { pageIndex, bbox },
    operatorIndex,
    visibility: context.visibility(bbox, opacity),
  }
}

function strokeExtent(box: Rect, transform: Matrix, width: number) {
  const x = (width * Math.hypot(transform[0], transform[2])) / 2
  const y = (width * Math.hypot(transform[1], transform[3])) / 2
  return { x: box.x - x, y: box.y - y, width: box.width + 2 * x, height: box.height + 2 * y }
}

function axisOfStrip(box: Rect): VectorRule['orientation'] | undefined {
  if (box.width >= 12 && box.height <= 3 && box.width >= box.height * 10) return 'h'
  if (box.height >= 12 && box.width <= 3 && box.height >= box.width * 10) return 'v'
}

function simpleSegments(data: unknown, transform: Matrix): [Point, Point][] {
  const packed = Array.isArray(data) ? numbers(data[0]) : undefined
  if (!packed || packed.length % 6 !== 0) return []
  const lines: [Point, Point][] = []
  for (let i = 0; i < packed.length; i += 6) {
    if (packed[i] !== 0 || packed[i + 3] !== 1) return []
    lines.push([
      point(transform, packed[i + 1], packed[i + 2]),
      point(transform, packed[i + 4], packed[i + 5]),
    ])
  }
  return lines
}

interface PathPaint {
  paths: unknown
  bounds: unknown
  rectangles: Rect[]
  compound: boolean
  strokeWidth: number
  fill?: string | null
  stroke?: string | null
  fillOpacity: number
  strokeOpacity: number
}

export function recordPath(graphics: NativeGraphics, context: Context, paint: PathPaint) {
  const opacity = Math.max(paint.fillOpacity, paint.strokeOpacity)
  const fill = paint.fillOpacity > 0 ? parseRgb(paint.fill) : undefined
  const stroke = paint.strokeOpacity > 0 ? parseRgb(paint.stroke) : undefined
  const ambiguous = paint.compound
  if (paint.fillOpacity > 0 && !ambiguous) {
    for (const box of paint.rectangles) {
      const orientation = axisOfStrip(box)
      if (orientation)
        graphics.rules.push({ ...position(context, box, opacity), orientation, source: 'fill' })
    }
  }
  const width = paint.strokeOpacity > 0 ? Math.max(0, paint.strokeWidth) : 0
  if (paint.strokeOpacity > 0) {
    for (const line of simpleSegments(paint.paths, context.transform)) {
      const box = extent(line)
      const orientation =
        box.height <= 0.03 && box.width >= 12
          ? 'h'
          : box.width <= 0.03 && box.height >= 12
            ? 'v'
            : undefined
      if (orientation) {
        const estimate = strokeExtent(box, context.transform, width || 0.02)
        graphics.rules.push({
          ...position(context, estimate, paint.strokeOpacity),
          orientation,
          source: 'stroke',
        })
      }
    }
  }
  const bounds = formBounds(paint.bounds, context.transform)
  if (!bounds || !opacity) return
  const withStroke = width > 0 ? strokeExtent(bounds, context.transform, width) : bounds
  if (withStroke.width <= 0 || withStroke.height <= 0) return
  const observation = position(context, withStroke, opacity)
  graphics.paths.push({
    ...observation,
    outline: paint.rectangles.length && !ambiguous ? 'rectangles' : 'affine-envelope',
    fill,
    stroke,
    visibility:
      ambiguous && observation.visibility === 'paint-command'
        ? 'unresolved'
        : observation.visibility,
  })
}
