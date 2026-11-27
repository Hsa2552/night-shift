// @vitest-environment node
import type { TextItem, TextStyle } from 'pdfjs-dist/types/src/display/api'
import { describe, expect, it } from 'vitest'
import { mapTextItem } from './text-geometry'

const item: TextItem = {
  str: 'Texte synthétique',
  dir: 'ltr',
  transform: [10, 0, 5, 10, 20, 60],
  width: 40,
  height: 10,
  fontName: 'fixture',
  hasEOL: true,
}
const style: TextStyle = { ascent: 0.8, descent: -0.2, vertical: false, fontFamily: 'sans-serif' }

describe('PDF text geometry', () => {
  it('preserves the slant of a text matrix when finding its bounds', () => {
    const mapped = mapTextItem(item, style, [1, 0, 0, -1, 0, 100])
    expect(mapped).toMatchObject({
      text: 'Texte synthétique',
      fontName: 'fixture',
      hasEOL: true,
      bbox: { x: 19, y: 32, width: 45, height: 10 },
    })
  })

  it('handles a rotated, translated viewport in the same coordinate system as the canvas', () => {
    const mapped = mapTextItem(item, style, [0, 2, 2, 0, -40, -10])
    expect(mapped.bbox).toEqual({ x: 76, y: 28, width: 20, height: 90 })
  })

  it('falls back to finite bounds for a symbol font with invalid metrics', () => {
    const symbolFont = { ...style, fontFamily: 'ZapfDingbats' }
    const viewport = [1, 0, 0, -1, 0, 100]
    expect(
      mapTextItem(item, { ...symbolFont, ascent: NaN, descent: -Infinity }, viewport).bbox,
    ).toEqual({ x: 19, y: 32, width: 45, height: 10 })
    expect(
      mapTextItem(item, { ...symbolFont, ascent: NaN, descent: -0.25 }, viewport).bbox,
    ).toEqual({ x: 18.75, y: 32.5, width: 45, height: 10 })
  })
})
