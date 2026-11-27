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
  const angle = Math.atan2(b, a) + (vertical ? Math.PI / 2 : 0)
  const fontSize = Math.hypot(c, d)
  const scale = Math.hypot(viewportTransform[0], viewportTransform[1])
  const advance = (vertical ? item.height : item.width) * scale
  const ascent = fontSize * (style?.ascent ?? (style?.descent != null ? 1 + style.descent : 0.8))
  const descent = fontSize * (style?.descent ?? -0.2)
  const alongX = Math.cos(angle) * advance
  const alongY = Math.sin(angle) * advance
  const ascentX = x + Math.sin(angle) * ascent
  const ascentY = y - Math.cos(angle) * ascent
  const descentX = x + Math.sin(angle) * descent
  const descentY = y - Math.cos(angle) * descent
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
