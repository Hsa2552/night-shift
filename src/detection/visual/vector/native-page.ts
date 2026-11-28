import type { PDFPageProxy } from 'pdfjs-dist'
import type { TextItem } from '../../../shared/types'
import { observeVectorPage, symbolKind, type NativeGlyph } from './index'
import type { FontMetrics } from './glyph-run'
import { matrix } from './geometry'
import { highlightRegions } from './graphics'
import { relateSymbols, type NativeSymbol } from './symbol-relations'
import { associateTextColors, nativeGlyphColor } from './text-colors'

type NativePageSource = Pick<
  PDFPageProxy,
  'pageNumber' | 'getViewport' | 'getOperatorList' | 'commonObjs'
> &
  Partial<Pick<PDFPageProxy, 'getAnnotations'>>

/**
 * `items` must be this page's C1 fragments. The original array and its indexes are preserved.
 * Paint and glyph strings are transient, and confidence concerns association before compositing.
 */
export async function observeNativePage(source: NativePageSource, items: readonly TextItem[]) {
  const glyphs: NativeGlyph[] = []
  const fonts = new Map<string, FontMetrics | undefined>()
  const annotationTask = source.getAnnotations?.({ intent: 'display' }).catch(() => undefined)
  const vector = await observeVectorPage(source, {
    getFont(id) {
      if (!fonts.has(id)) {
        const font = source.commonObjs.has(id) ? source.commonObjs.get(id) : undefined
        fonts.set(id, font && typeof font === 'object' ? font : undefined)
      }
      return fonts.get(id)
    },
    onGlyph: (glyph) => glyphs.push(glyph),
  })
  const symbols: NativeSymbol[] = []
  for (const glyph of glyphs) {
    const kind = symbolKind(glyph.unicode)
    if (!kind) continue
    symbols.push({
      region: { pageIndex: vector.pageIndex, bbox: glyph.bbox },
      operatorIndex: glyph.paint.operatorIndex,
      kind,
      visibility: glyph.visibility,
      rgb: nativeGlyphColor(glyph),
      geometry: 'font-cell',
    })
  }
  if (vector.graphics && annotationTask) {
    const viewport = matrix(source.getViewport({ scale: 1 }).transform)
    const annotations = await annotationTask
    if (annotations && viewport)
      vector.graphics.highlights = highlightRegions(annotations, vector, viewport)
  }
  return {
    ...vector,
    textColors: associateTextColors(items, glyphs),
    glyphSymbols: symbols,
    ...relateSymbols(vector, symbols),
  }
}
