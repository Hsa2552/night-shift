import type { PageRegion, Rect } from '../../../shared/types'
import { nativeSquares } from './cases'
import { intersect } from './geometry'
import type { SymbolKind, VectorPageObservation, Visibility } from './index'
import { parseRgb, type NativeRgb } from './text-colors'

export interface NativeSymbol {
  region: PageRegion
  operatorIndex: number
  kind: SymbolKind
  visibility: Visibility
  rgb?: NativeRgb
  geometry: 'font-cell'
}

export type NativeFrame =
  | { kind: 'glyph'; symbolIndex: number; region: PageRegion }
  | { kind: 'drawn'; operatorIndices: number[]; region: PageRegion }

export interface MarkRelation {
  frame: NativeFrame
  markIndex: number
  kind: 'overlap' | 'nearby'
  overlap: number
  distance: number
}

export interface BackgroundRelation {
  frame: NativeFrame
  region: PageRegion
  operatorIndex: number
  rgb: NativeRgb
}

function overlapOf(a: Rect, b: Rect) {
  const overlap = intersect(a, b)
  return overlap ? overlap.width * overlap.height : 0
}

const area = (r: Rect) => r.width * r.height

function insideGap(a: Rect, b: Rect) {
  return Math.hypot(
    Math.max(0, a.x - b.x - b.width, b.x - a.x - a.width),
    Math.max(0, a.y - b.y - b.height, b.y - a.y - a.height),
  )
}

export function relateSymbols(vector: VectorPageObservation, symbols: readonly NativeSymbol[]) {
  const frames: { frame: NativeFrame; operatorIndex: number }[] = []
  const marks: { markIndex: number; box: Rect }[] = []
  for (const [symbolIndex, symbol] of symbols.entries()) {
    if (symbol.visibility !== 'paint-command') continue
    const { kind, operatorIndex, region } = symbol
    if (kind === 'empty-square' || kind === 'empty-circle') {
      frames.push({ frame: { kind: 'glyph', symbolIndex, region }, operatorIndex })
    }
    if (kind === 'tick' || kind === 'cross')
      marks.push({ markIndex: symbolIndex, box: region.bbox })
  }
  for (const { region, paint } of nativeSquares(vector.rectangles)) {
    const operatorIndices = [...new Set(paint.map((p) => p.operatorIndex))]
    frames.push({
      frame: { kind: 'drawn', region, operatorIndices },
      operatorIndex: Math.min(...operatorIndices),
    })
  }
  const markRelations: MarkRelation[] = []
  const backgroundRelations: BackgroundRelation[] = []
  const fills = vector.rectangles.flatMap((rect) => {
    const rgb = parseRgb(rect.fill)
    return rgb &&
      Math.max(...rgb) - Math.min(...rgb) >= 20 &&
      (rect.fillOpacity ?? 0) >= 0.95 &&
      rect.visibility === 'paint-command'
      ? [{ ...rect, rgb }]
      : []
  })
  for (const { frame, operatorIndex } of frames) {
    const box = frame.region.bbox
    const size = Math.max(box.width, box.height)
    for (const { markIndex, box: mark } of marks) {
      const overlap = overlapOf(box, mark) / Math.min(area(box), area(mark))
      const distance = insideGap(box, mark)
      if (overlap >= 0.3)
        markRelations.push({ frame, markIndex, kind: 'overlap', overlap, distance })
      else if (distance <= 0.45 * size && Math.max(mark.width, mark.height) <= 1.8 * size)
        markRelations.push({ frame, markIndex, kind: 'nearby', overlap, distance })
    }
    for (const fill of fills) {
      const background = fill.region.bbox
      if (
        fill.operatorIndex >= operatorIndex ||
        area(background) < 1.5 * area(box) ||
        area(background) > 0.25 * vector.width * vector.height ||
        overlapOf(box, background) < 0.95 * area(box)
      )
        continue
      backgroundRelations.push({
        frame,
        region: fill.region,
        operatorIndex: fill.operatorIndex,
        rgb: fill.rgb,
      })
    }
  }
  return { markRelations, backgroundRelations }
}
