import { Util } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem as PdfTextItem, TextStyle } from 'pdfjs-dist/types/src/display/api'
import type { TextItem } from '../shared/types'

export function mapTextItem(
  item: PdfTextItem,
  style: TextStyle | undefined,
  viewportTransform: number[],
): TextItem {
  const [a, b, c, d, x, y] = Util.transform(viewportTransform, item.transform)
  const vertical = style?.vertical === true
  const baselineLength = Math.hypot(a, b)
  const fontSize = Math.hypot(c, d)
  const scale = Math.hypot(viewportTransform[0], viewportTransform[1])
  const advance = (vertical ? item.height : item.width) * scale
  const ascent = style?.ascent ?? (style?.descent != null ? 1 + style.descent : 0.8)
  const descent = style?.descent ?? -0.2
  const alongX = vertical ? (-c / (fontSize || 1)) * advance : (a / (baselineLength || 1)) * advance
  const alongY = vertical ? (-d / (fontSize || 1)) * advance : (b / (baselineLength || 1)) * advance
  // Use the transformed font axes, so a sheared or mirrored text matrix is preserved.
  const upX = vertical ? (a / (baselineLength || 1)) * fontSize : c
  const upY = vertical ? (b / (baselineLength || 1)) * fontSize : d
  const ascentX = x + upX * ascent
  const ascentY = y + upY * ascent
  const descentX = x + upX * descent
  const descentY = y + upY * descent
  const minX = Math.min(ascentX, ascentX + alongX, descentX, descentX + alongX)
  const minY = Math.min(ascentY, ascentY + alongY, descentY, descentY + alongY)
  const maxX = Math.max(ascentX, ascentX + alongX, descentX, descentX + alongX)
  const maxY = Math.max(ascentY, ascentY + alongY, descentY, descentY + alongY)

  return {
    text: item.str,
    bbox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    fontSize,
    fontName: item.fontName,
    hasEOL: item.hasEOL,
  }
}
