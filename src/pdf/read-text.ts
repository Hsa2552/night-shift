import type { PDFPageProxy, TextContent, TextStyle } from 'pdfjs-dist/types/src/display/api'
import type { TextItem } from '../shared/types'
import { mapTextItem } from './text-geometry'

export async function readPageText(
  page: PDFPageProxy,
  viewportTransform: number[],
  isPureXfa: boolean,
): Promise<TextItem[]> {
  const textItems: TextItem[] = []
  const styles: Record<string, TextStyle> = Object.create(null)

  function append(content: TextContent) {
    Object.assign(styles, content.styles)
    for (const item of content.items) {
      if ('str' in item) textItems.push(mapTextItem(item, styles[item.fontName], viewportTransform))
    }
  }

  if (isPureXfa) {
    // PDF.js extracts this text from its XFA layer rather than the page stream.
    append(await page.getTextContent())
    return textItems
  }

  // Convert each chunk once instead of retaining a second array of raw fragments.
  const stream = page.streamTextContent() as ReadableStream<TextContent>
  const reader = stream.getReader()
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      append(chunk.value)
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }
  return textItems
}
