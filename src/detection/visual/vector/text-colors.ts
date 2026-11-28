import type { Rect, TextItem } from '../../../shared/types'
import { intersect, type Point } from './geometry'
import type { NativeGlyph } from './index'

export type NativeRgb = [red: number, green: number, blue: number]

export interface TextColorRange {
  /** Half-open UTF-16 offsets in the original TextItem.text. */
  start: number
  end: number
  rgb: NativeRgb
  operatorIndices: number[]
  evidence: 'text-and-geometry'
}

export interface TextColorObservation {
  textIndex: number
  status: 'matched' | 'partial' | 'ambiguous' | 'unmatched'
  ranges: TextColorRange[]
}

const strip = /[\s\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/gu
const normalizeGlyph = (text: string) => text.normalize('NFKD').replace(strip, '')
const dot = ([x, y]: Point, [a, b]: Point) => x * a + y * b

export function parseRgb(color: string | null | undefined): NativeRgb | undefined {
  if (!color || !/^#[0-9a-f]{6}$/iu.test(color)) return
  return [1, 3, 5].map((at) => Number.parseInt(color.slice(at, at + 2), 16)) as NativeRgb
}

function normalizedText(text: string) {
  let value = ''
  let at = 0
  const offsets: { start: number; end: number }[] = []
  for (const char of text) {
    const part = normalizeGlyph(char)
    for (let i = 0; i < part.length; i++) offsets.push({ start: at, end: at + char.length })
    value += part
    at += char.length
  }
  return { value, offsets }
}

export function nativeGlyphColor(glyph: NativeGlyph): NativeRgb | undefined {
  if (glyph.visibility !== 'paint-command') return
  const { fill, stroke, mode, fillOpacity, strokeOpacity } = glyph.paint
  if ((mode & 3) === 3) return
  const inks = []
  if ((mode & 3) !== 1 && fill !== 'transparent' && fillOpacity > 0)
    inks.push([fill, fillOpacity] as const)
  if ((mode & 3) !== 0 && stroke !== 'transparent' && strokeOpacity > 0)
    inks.push([stroke, strokeOpacity] as const)
  const color = inks[0]?.[0]?.toLowerCase()
  if (inks.some(([candidate, opacity]) => candidate?.toLowerCase() !== color || opacity < 0.98))
    return
  return parseRgb(color)
}

interface PositionedToken {
  glyph: NativeGlyph
  value: string
}

interface Line {
  axis: Point
  normal: Point
  position: number
  tokens: PositionedToken[]
}

interface Slot {
  position: number
  tokens: PositionedToken[]
}

interface AlignedSlot {
  tokens: PositionedToken[]
  at: number
  length: number
}

const midpoint = (box: Rect): Point => [box.x + box.width / 2, box.y + box.height / 2]
const rowHeight = 24

function byLine(candidates: PositionedToken[]): Line[] {
  const lines: Line[] = []
  for (const token of candidates) {
    const { origin, axis, em } = token.glyph
    const line = lines.find(
      (line) =>
        Math.abs(dot(line.axis, axis)) >= 0.98 &&
        Math.abs(dot(origin, line.normal) - line.position) <= Math.max(0.7, em * 0.17),
    )
    if (line) line.tokens.push(token)
    else {
      const normal: Point = [-axis[1], axis[0]]
      lines.push({ axis, normal, position: dot(origin, normal), tokens: [token] })
    }
  }
  return lines
}

function slotsOn(line: Line) {
  const positioned = line.tokens
    .map((token) => ({ token, position: dot(token.glyph.origin, line.axis) }))
    .sort((a, b) => a.position - b.position)
  const slots: Slot[] = []
  for (const { token, position } of positioned) {
    const previous = slots.at(-1)
    const first = previous?.tokens[0]?.glyph
    if (
      previous &&
      first &&
      position - previous.position <= Math.min(first.em, token.glyph.em) * 0.08
    ) {
      const a = first.bbox
      const b = token.glyph.bbox
      const overlap = intersect(a, b)
      if (
        overlap &&
        overlap.width * overlap.height >= 0.64 * Math.min(a.width * a.height, b.width * b.height)
      ) {
        previous.tokens.push(token)
        continue
      }
    }
    slots.push({ position, tokens: [token] })
  }
  return slots
}

function align(target: string, slots: Slot[], matches: AlignedSlot[][]) {
  for (let start = 0; start < slots.length && matches.length < 2; start++) {
    const match: AlignedSlot[] = []
    let at = 0
    for (let i = start; i < slots.length && at < target.length; i++) {
      const { tokens } = slots[i]
      const accepted = tokens.filter(({ value }) => target.startsWith(value, at))
      if (accepted.length === 0) break
      // Some producers overprint an accented glyph and its base glyph at the same position.
      // Consume the longest spelling compatible with the fragment, while retaining every paint.
      const length = Math.max(...accepted.map(({ value }) => value.length))
      match.push({
        tokens,
        at,
        length,
      })
      at += length
    }
    if (at !== target.length) continue
    // Forward and reverse coincide for a one-glyph fragment.
    if (
      !matches.some(
        (m) =>
          m.length === match.length && m.every((slot, i) => slot.tokens[0] === match[i].tokens[0]),
      )
    )
      matches.push(match)
  }
}

function colorRanges(
  slots: AlignedSlot[],
  offsets: ReturnType<typeof normalizedText>['offsets'],
): Pick<TextColorObservation, 'status' | 'ranges'> {
  type UnitColor = Pick<TextColorRange, 'rgb' | 'operatorIndices'>
  const units: (UnitColor | undefined)[] = Array.from({ length: offsets.length })
  for (const { tokens, at, length } of slots) {
    const paints = tokens.map(({ glyph }) => nativeGlyphColor(glyph))
    const rgb = paints[0]
    if (!rgb || paints.some((p) => p?.join(',') !== rgb.join(','))) continue
    const operatorIndices = [...new Set(tokens.map(({ glyph }) => glyph.paint.operatorIndex))]
    units.fill({ rgb, operatorIndices }, at, at + length)
  }
  const ranges: TextColorRange[] = []
  let unresolved = false
  let previousAccepted = false
  for (let at = 0; at < offsets.length;) {
    const { start, end } = offsets[at]
    let stop = at + 1
    while (stop < offsets.length && offsets[stop].start === start) stop++
    const sameCharacter = units.slice(at, stop)
    at = stop
    const rgb = sameCharacter[0]?.rgb
    if (!rgb || sameCharacter.some((part) => part?.rgb.join(',') !== rgb.join(','))) {
      unresolved = true
      previousAccepted = false
      continue
    }
    const operators = [...new Set(sameCharacter.flatMap((part) => part?.operatorIndices ?? []))]
    const previous = ranges.at(-1)
    if (previousAccepted && previous?.rgb.join(',') === rgb.join(',')) {
      previous.end = end
      for (const operator of operators)
        if (!previous.operatorIndices.includes(operator)) previous.operatorIndices.push(operator)
    } else {
      ranges.push({
        start,
        end,
        rgb,
        operatorIndices: [...new Set(operators)],
        evidence: 'text-and-geometry',
      })
    }
    previousAccepted = true
  }
  return { status: unresolved ? (ranges.length ? 'partial' : 'ambiguous') : 'matched', ranges }
}

export function associateTextColors(
  items: readonly TextItem[],
  glyphs: readonly NativeGlyph[],
): TextColorObservation[] {
  const buckets = new Map<number, PositionedToken[]>()
  for (const glyph of glyphs) {
    const value = normalizeGlyph(glyph.unicode)
    if (!value) continue
    const row = Math.floor(midpoint(glyph.bbox)[1] / rowHeight)
    let bucket = buckets.get(row)
    if (!bucket) buckets.set(row, (bucket = []))
    bucket.push({ glyph, value })
  }
  return items.map(({ text, bbox, fontSize, fontName }, textIndex) => {
    const { value, offsets } = normalizedText(text)
    const empty: TextColorObservation = { textIndex, status: 'unmatched', ranges: [] }
    if (
      !value ||
      bbox.width <= 0 ||
      bbox.height <= 0 ||
      !Object.values(bbox).every(Number.isFinite)
    )
      return empty
    const pad = Math.max(1.2, (fontSize ?? Math.min(bbox.width, bbox.height)) * 0.2)
    const zone = {
      x: bbox.x - pad,
      y: bbox.y - pad,
      width: bbox.width + pad * 2,
      height: bbox.height + pad * 2,
    }
    const candidates: PositionedToken[] = []
    const first = Math.floor(zone.y / rowHeight)
    const last = Math.floor((zone.y + zone.height) / rowHeight)
    // Iterating occupied buckets also bounds work on malformed, very tall text boxes.
    for (const [row, tokens] of buckets) {
      if (row < first || row > last) continue
      for (const token of tokens) {
        const { glyph } = token
        if (fontName && glyph.paint.font !== fontName) continue
        const [x, y] = midpoint(glyph.bbox)
        if (x < zone.x || x > zone.x + zone.width || y < zone.y || y > zone.y + zone.height)
          continue
        const overlap = intersect(zone, glyph.bbox)
        if (
          overlap &&
          overlap.width * overlap.height >= 0.55 * glyph.bbox.width * glyph.bbox.height
        )
          candidates.push(token)
      }
    }
    const matches: AlignedSlot[][] = []
    for (const line of byLine(candidates)) {
      const slots = slotsOn(line)
      align(value, slots, matches)
      if (matches.length < 2) align(value, slots.reverse(), matches)
      if (matches.length >= 2) return { ...empty, status: 'ambiguous' }
    }
    return matches.length ? { textIndex, ...colorRanges(matches[0], offsets) } : empty
  })
}
