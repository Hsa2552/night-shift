import type { Rect } from '../../../shared/types'
import { extent, point, type Matrix, type Point } from './geometry'

export interface FontMetrics {
  fontMatrix?: unknown
  vertical?: boolean
  isType3Font?: boolean
  isInvalidPDFjsFont?: boolean
  missingFile?: boolean
  ascent?: number
  descent?: number
}

export interface GlyphCursor {
  x: number
  y: number
}

export interface GlyphRun {
  transform: Matrix
  cursor: GlyphCursor
  font: FontMetrics
  size: number
  horizontalScale: number
  wordSpacing: number
  charSpacing: number
  rise: number
}

export interface PositionedGlyph {
  unicode: string
  origin: Point
  axis: Point
  bbox: Rect
  em: number
  present: boolean
}

interface PdfGlyph {
  unicode?: string
  width?: number
  isSpace?: boolean
  isInFont?: boolean
  vmetric?: number[]
  isRotated?: boolean
}

export function placeGlyphs(
  values: unknown[],
  run: GlyphRun,
  emit: (glyph: PositionedGlyph) => void,
): GlyphCursor | undefined {
  const { transform, font, horizontalScale, wordSpacing, charSpacing, rise } = run
  const { x, y } = run.cursor
  const size = Math.abs(run.size)
  const direction = Math.sign(run.size)
  if (font.isType3Font || font.isInvalidPDFjsFont || !size || !direction || !horizontalScale) return
  const scale = horizontalScale * direction
  const fontMatrix = Array.isArray(font.fontMatrix) ? font.fontMatrix[0] : 0.001
  if (typeof fontMatrix !== 'number' || fontMatrix <= 0 || !Number.isFinite(fontMatrix)) return
  const advanceScale = size * fontMatrix
  const vertical = font.vertical === true
  const dx = vertical ? -transform[2] : transform[0] * Math.sign(scale)
  const dy = vertical ? -transform[3] : transform[1] * Math.sign(scale)
  const length = Math.hypot(dx, dy)
  if (length === 0 || !Number.isFinite(length)) return
  const axis: Point = [dx / length, dy / length]
  const em =
    size *
    (vertical ? Math.hypot(transform[0], transform[1]) : Math.hypot(transform[2], transform[3]))
  if (!(em > 0) || !Number.isFinite(em)) return
  const low = size * (Number.isFinite(font.descent) ? font.descent! : -0.2) * direction
  const high = size * (Number.isFinite(font.ascent) ? font.ascent! : 0.8) * direction
  let advance = 0
  for (const entry of values) {
    if (typeof entry === 'number') {
      if (!Number.isFinite(entry)) return
      advance += ((vertical ? 1 : -1) * entry * size) / 1_000
      continue
    }
    if (!entry || typeof entry !== 'object') return
    const glyph = entry as PdfGlyph
    const { unicode, width, vmetric } = glyph
    if (typeof width !== 'number' || !Number.isFinite(width)) return
    const spacing = (glyph.isSpace ? wordSpacing : 0) + charSpacing
    let inkAdvance = width * advanceScale
    let left = x + advance * scale
    let base = y + rise
    if (vertical) {
      if (!vmetric || vmetric.length < 3 || !vmetric.slice(0, 3).every(Number.isFinite)) return
      inkAdvance = -vmetric[0] * advanceScale
      left = x - vmetric[1] * advanceScale * scale
      base += (advance + vmetric[2] * advanceScale) * -direction
    }
    if (unicode && !/^\s+$/u.test(unicode) && !glyph.isRotated) {
      const right = left + width * advanceScale * scale
      const bbox = extent([
        point(transform, left, base + low),
        point(transform, left, base + high),
        point(transform, right, base + low),
        point(transform, right, base + high),
      ])
      if (bbox.width > 0 && bbox.height > 0 && Object.values(bbox).every(Number.isFinite)) {
        // The extent represents the font cell, which can be larger than the actual ink outline.
        emit({
          unicode,
          bbox,
          em,
          axis,
          origin: point(transform, left, base),
          present: glyph.isInFont !== false || font.missingFile === true,
        })
      }
    }
    advance += inkAdvance + spacing * direction * (vertical ? -1 : 1)
  }
  return vertical ? { x, y: y - advance } : { x: x + advance * scale, y }
}
