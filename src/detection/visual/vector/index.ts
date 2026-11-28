import { OPS, type PDFPageProxy } from 'pdfjs-dist'
import type { PageDimensions, PageRegion, Rect } from '../../../shared/types'
import {
  compose,
  formBounds,
  identity,
  intersect,
  matrix,
  point,
  rectanglesFromPath,
  type Matrix,
  type Point,
} from './geometry'
import { placeGlyphs, type FontMetrics, type GlyphCursor, type PositionedGlyph } from './glyph-run'
import type { NativeSymbol } from './native-page'
import type { TextColorObservation } from './text-colors'

export type Visibility = 'paint-command' | 'clipped' | 'invisible' | 'unresolved'

export interface VectorRectangle {
  region: PageRegion
  operatorIndex: number
  fill?: string | null
  stroke?: string | null
  fillOpacity?: number
  strokeOpacity?: number
  lineWidth?: number
  visibility: Visibility
}

export interface VectorTextPaint {
  operatorIndex: number
  origin?: Point
  glyphCount: number
  symbols: Partial<Record<SymbolKind, number>>
  font?: string
  size?: number
  fill: string | null
  stroke: string | null
  fillOpacity: number
  strokeOpacity: number
  mode: number
  visibility: Visibility
}

export type SymbolKind =
  | 'empty-square'
  | 'filled-square'
  | 'marked-square'
  | 'tick'
  | 'cross'
  | 'empty-circle'
  | 'filled-circle'

const symbols: Record<string, SymbolKind> = {
  '□': 'empty-square',
  '☐': 'empty-square',
  '▫': 'empty-square',
  '■': 'filled-square',
  '▪': 'filled-square',
  '☑': 'marked-square',
  '☒': 'marked-square',
  '✓': 'tick',
  '✔': 'tick',
  '✗': 'cross',
  '✘': 'cross',
  '✕': 'cross',
  '×': 'cross',
  '○': 'empty-circle',
  '◯': 'empty-circle',
  '●': 'filled-circle',
}

export function symbolKind(unicode: string): SymbolKind | undefined {
  return Object.hasOwn(symbols, unicode) ? symbols[unicode] : undefined
}

function glyphInfo(glyphs: unknown[]) {
  let glyphCount = 0
  const counts: VectorTextPaint['symbols'] = {}
  for (const glyph of glyphs) {
    if (!glyph || typeof glyph !== 'object') continue
    glyphCount++
    if (!('unicode' in glyph) || typeof glyph.unicode !== 'string') continue
    const symbol = symbolKind(glyph.unicode)
    if (symbol) counts[symbol] = (counts[symbol] ?? 0) + 1
  }
  return { glyphCount, symbols: counts }
}

export interface VectorPageObservation extends PageDimensions {
  rectangles: VectorRectangle[]
  textPaint: VectorTextPaint[]
  unresolvedPaths: number
  unsupportedPathEncoding: number
  images: number
  textColors?: TextColorObservation[]
  glyphSymbols?: NativeSymbol[]
}

interface GraphicState {
  transform: Matrix
  clip: Rect | null
  complex: boolean
  fill: string | null
  stroke: string | null
  fillOpacity: number
  strokeOpacity: number
  lineWidth: number
  font?: string
  size?: number
  mode: number
  textMatrix: Matrix
  lineX: number
  lineY: number
  leading: number
  rise: number
  originKnown: boolean
  cursor: GlyphCursor
  signedSize: number
  horizontalScale: number
  wordSpacing: number
  charSpacing: number
}

export interface NativeGlyph extends PositionedGlyph {
  paint: VectorTextPaint
  visibility: Visibility
}

interface GlyphCapture {
  getFont: (id: string) => FontMetrics | undefined
  onGlyph: (glyph: NativeGlyph) => void
}

const fillOps = new Set([
  OPS.fill,
  OPS.eoFill,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke,
])
const strokeOps = new Set([
  OPS.stroke,
  OPS.closeStroke,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke,
])
const imageOps = new Set([
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintInlineImageXObjectGroup,
  OPS.paintImageXObjectRepeat,
  OPS.paintImageMaskXObject,
  OPS.paintImageMaskXObjectGroup,
  OPS.paintImageMaskXObjectRepeat,
  OPS.paintSolidColorImageMask,
])

function visibility(
  state: GraphicState,
  bounds: Rect | null,
  opacity: number,
  optional: boolean,
): Visibility {
  if (opacity <= 0) return 'invisible'
  if (!state.clip) return 'clipped'
  if (bounds) {
    const clipped = intersect(state.clip, bounds)
    if (!clipped || clipped.width < bounds.width - 0.01 || clipped.height < bounds.height - 0.01) {
      return 'clipped'
    }
  }
  return state.complex || optional ? 'unresolved' : 'paint-command'
}

function opacity(value: unknown, previous: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : previous
}

function move(state: GraphicState, x: number, y: number) {
  state.lineX += x
  state.lineY += y
  state.cursor = { x: state.lineX, y: state.lineY }
  state.originKnown = true
}

interface OperatorList {
  fnArray: readonly number[]
  argsArray: readonly unknown[]
}

export function readVectorOperators(
  page: PageDimensions,
  viewport: Matrix,
  list: OperatorList,
  capture?: GlyphCapture,
): VectorPageObservation {
  const output: VectorPageObservation = {
    ...page,
    rectangles: [],
    textPaint: [],
    unresolvedPaths: 0,
    unsupportedPathEncoding: 0,
    images: 0,
  }
  let state: GraphicState = {
    transform: viewport,
    clip: { x: 0, y: 0, width: page.width, height: page.height },
    fill: '#000000',
    stroke: '#000000',
    fillOpacity: 1,
    strokeOpacity: 1,
    lineWidth: 1,
    complex: false,
    mode: 0,
    textMatrix: identity,
    lineX: 0,
    lineY: 0,
    leading: 0,
    rise: 0,
    originKnown: false,
    cursor: { x: 0, y: 0 },
    signedSize: 0,
    horizontalScale: 1,
    wordSpacing: 0,
    charSpacing: 0,
  }
  const stack: GraphicState[] = []
  const markedContent: boolean[] = []
  let pendingClip = false
  const save = () => stack.push({ ...state })
  const restore = () => {
    state = stack.pop() ?? state
  }
  const transform = (value: unknown) => {
    const next = matrix(value)
    if (next) state.transform = compose(state.transform, next)
    else state.complex = true
  }
  const clip = (box: Rect | undefined) => {
    if (box) state.clip = state.clip ? intersect(state.clip, box) : null
    else state.complex = true
  }
  const setFont = (font: unknown, size: unknown) => {
    if (typeof font === 'string') state.font = font
    if (typeof size === 'number' && Number.isFinite(size)) {
      state.size = Math.abs(size)
      state.signedSize = size
    }
  }

  for (const [operatorIndex, op] of list.fnArray.entries()) {
    const entry = list.argsArray[operatorIndex]
    const args: unknown[] = Array.isArray(entry) ? entry : []
    if (imageOps.has(op)) output.images++
    switch (op) {
      case OPS.save:
        save()
        break
      case OPS.restore:
        restore()
        break
      case OPS.transform:
        transform(args)
        break
      case OPS.paintFormXObjectBegin:
        save()
        if (args[0]) transform(args[0])
        if (args[1]) {
          const [a, b, c, d] = state.transform
          const aligned =
            (Math.abs(b) < 1e-7 && Math.abs(c) < 1e-7) || (Math.abs(a) < 1e-7 && Math.abs(d) < 1e-7)
          if (!aligned) state.complex = true
          clip(formBounds(args[1], state.transform))
        }
        break
      case OPS.paintFormXObjectEnd:
      case OPS.endGroup:
      case OPS.endAnnotation:
        restore()
        break
      case OPS.beginGroup:
      case OPS.beginAnnotation:
        save()
        // These contexts can change geometry and composition beyond an affine form.
        state.complex = true
        break
      case OPS.beginMarkedContent:
      case OPS.beginMarkedContentProps:
        markedContent.push(args[0] === 'OC')
        break
      case OPS.endMarkedContent:
        markedContent.pop()
        break
      case OPS.setFillRGBColor:
        state.fill = typeof args[0] === 'string' ? args[0] : null
        break
      case OPS.setStrokeRGBColor:
        state.stroke = typeof args[0] === 'string' ? args[0] : null
        break
      case OPS.setFillTransparent:
        state.fill = 'transparent'
        break
      case OPS.setStrokeTransparent:
        state.stroke = 'transparent'
        break
      case OPS.setFillColorN:
        state.fill = null
        break
      case OPS.setStrokeColorN:
        state.stroke = null
        break
      case OPS.setLineWidth:
        if (typeof args[0] === 'number') state.lineWidth = args[0]
        break
      case OPS.setGState:
        if (!Array.isArray(args[0])) break
        for (const pair of args[0]) {
          if (!Array.isArray(pair)) continue
          const [name, value] = pair
          if (name === 'ca') state.fillOpacity = opacity(value, state.fillOpacity)
          if (name === 'CA') state.strokeOpacity = opacity(value, state.strokeOpacity)
          if (name === 'LW' && typeof value === 'number') state.lineWidth = value
          if (name === 'Font' && Array.isArray(value)) setFont(value[0], value[1])
          if ((name === 'SMask' && value) || (name === 'BM' && value !== 'source-over'))
            state.complex = true
        }
        break
      case OPS.clip:
      case OPS.eoClip:
        pendingClip = true
        break
      case OPS.constructPath: {
        const paint = typeof args[0] === 'number' ? args[0] : -1
        const fill = fillOps.has(paint)
        const stroke = strokeOps.has(paint)
        const closes = fill || paint === OPS.closeStroke || pendingClip
        if (args[2] && !(Array.isArray(args[1]) && args[1][0])) output.unsupportedPathEncoding++
        const decoded = rectanglesFromPath(args[1], state.transform, closes)
        let unresolvedPath = !decoded.complete
        for (const [index, bbox] of decoded.rectangles.entries()) {
          if (!(fill || stroke)) continue
          const fillAlpha = fill && state.fill !== 'transparent' ? state.fillOpacity : 0
          const strokeAlpha = stroke && state.stroke !== 'transparent' ? state.strokeOpacity : 0
          // Overlapping filled contours can be holes under the PDF winding rules.
          const unresolvedFill =
            fill &&
            (!decoded.complete ||
              decoded.rectangles.some((other, i) => i !== index && intersect(other, bbox)))
          unresolvedPath ||= unresolvedFill
          output.rectangles.push({
            region: { pageIndex: page.pageIndex, bbox },
            operatorIndex,
            ...(fill ? { fill: state.fill, fillOpacity: fillAlpha } : {}),
            ...(stroke
              ? { stroke: state.stroke, strokeOpacity: strokeAlpha, lineWidth: state.lineWidth }
              : {}),
            visibility: visibility(
              state,
              bbox,
              Math.max(fillAlpha, strokeAlpha),
              unresolvedFill || markedContent.includes(true),
            ),
          })
        }
        if (unresolvedPath && (fill || stroke || pendingClip)) output.unresolvedPaths++
        if (pendingClip) {
          clip(
            decoded.complete && decoded.rectangles.length === 1 ? decoded.rectangles[0] : undefined,
          )
          pendingClip = false
        }
        break
      }
      case OPS.endPath:
        if (pendingClip) state.complex = true
        pendingClip = false
        break
      case OPS.beginText:
        state.textMatrix = identity
        state.lineX = state.lineY = 0
        state.cursor = { x: 0, y: 0 }
        state.originKnown = true
        break
      case OPS.setTextMatrix: {
        const textMatrix = matrix(args[0]) ?? matrix(args)
        state.originKnown = Boolean(textMatrix)
        state.textMatrix = textMatrix ?? identity
        state.lineX = state.lineY = 0
        state.cursor = { x: 0, y: 0 }
        break
      }
      case OPS.setFont:
        setFont(args[0], args[1])
        break
      case OPS.setTextRenderingMode:
        if (typeof args[0] === 'number') state.mode = args[0]
        break
      case OPS.setTextRise:
        if (typeof args[0] === 'number') state.rise = args[0]
        break
      case OPS.setCharSpacing:
        if (typeof args[0] === 'number') state.charSpacing = args[0]
        break
      case OPS.setWordSpacing:
        if (typeof args[0] === 'number') state.wordSpacing = args[0]
        break
      case OPS.setHScale:
        if (typeof args[0] === 'number') state.horizontalScale = args[0] / 100
        break
      case OPS.setLeading:
        if (typeof args[0] === 'number') state.leading = -args[0]
        break
      case OPS.setLeadingMoveText:
        if (typeof args[0] === 'number' && typeof args[1] === 'number') {
          state.leading = args[1]
          move(state, args[0], args[1])
        }
        break
      case OPS.moveText:
        if (typeof args[0] === 'number' && typeof args[1] === 'number')
          move(state, args[0], args[1])
        break
      case OPS.nextLine:
        move(state, 0, state.leading)
        break
      case OPS.showText: {
        const mode = state.mode & 3
        const paintAlpha =
          mode === 3
            ? 0
            : Math.max(
                mode !== 1 && state.fill !== 'transparent' ? state.fillOpacity : 0,
                mode !== 0 && state.stroke !== 'transparent' ? state.strokeOpacity : 0,
              )
        let cursor: GlyphCursor | undefined
        if (Array.isArray(args[0])) {
          const transform = compose(state.transform, state.textMatrix)
          const optional = markedContent.includes(true)
          const paint: VectorTextPaint = {
            operatorIndex,
            origin: state.originKnown
              ? point(transform, state.cursor.x, state.cursor.y + state.rise)
              : undefined,
            ...glyphInfo(args[0]),
            font: state.font,
            size: state.size,
            mode: state.mode,
            fill: state.fill,
            stroke: state.stroke,
            fillOpacity: state.fillOpacity,
            strokeOpacity: state.strokeOpacity,
            visibility: visibility(state, null, paintAlpha, optional),
          }
          output.textPaint.push(paint)
          const font =
            capture && state.originKnown && state.font ? capture.getFont(state.font) : undefined
          if (capture && font) {
            cursor = placeGlyphs(
              args[0],
              { ...state, transform, font, size: state.signedSize },
              (glyph) =>
                capture.onGlyph({
                  ...glyph,
                  paint,
                  visibility: visibility(
                    state,
                    glyph.bbox,
                    glyph.present ? paintAlpha : 0,
                    optional,
                  ),
                }),
            )
          }
        }
        state.originKnown = Boolean(cursor)
        if (cursor) state.cursor = cursor
        if (state.mode >= 4) state.complex = true
        break
      }
    }
  }
  return output
}

type VectorPageSource = Pick<PDFPageProxy, 'pageNumber' | 'getViewport' | 'getOperatorList'>

/** Standalone PDF.js experiment. The production reader does not call this function. */
export async function observeVectorPage(
  source: VectorPageSource,
  capture?: GlyphCapture,
): Promise<VectorPageObservation> {
  const { width, height, transform } = source.getViewport({ scale: 1 })
  const viewport = matrix(transform)
  if (!viewport) throw new Error('Invalid PDF.js viewport transform')
  const list = await source.getOperatorList({ intent: 'display' })
  return readVectorOperators(
    { pageIndex: source.pageNumber - 1, width, height },
    viewport,
    list,
    capture,
  )
}
