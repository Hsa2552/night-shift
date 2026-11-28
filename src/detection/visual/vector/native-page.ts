import type { PDFPageProxy } from 'pdfjs-dist'
import type { PageRegion, TextItem } from '../../../shared/types'
import {
  observeVectorPage,
  symbolKind,
  type NativeGlyph,
  type SymbolKind,
  type Visibility,
} from './index'
import type { FontMetrics } from './glyph-run'
import { associateTextColors, nativeGlyphColor, type NativeRgb } from './text-colors'

export interface NativeSymbol {
  region: PageRegion
  operatorIndex: number
  kind: SymbolKind
  visibility: Visibility
  rgb?: NativeRgb
  geometry: 'font-cell'
}

type NativePageSource = Pick<
  PDFPageProxy,
  'pageNumber' | 'getViewport' | 'getOperatorList' | 'commonObjs'
>

/**
 * `items` must be this page's C1 fragments. The original array and its indexes are preserved.
 * Paint and glyph strings are transient, and confidence concerns association before compositing.
 */
export async function observeNativePage(source: NativePageSource, items: readonly TextItem[]) {
  const glyphs: NativeGlyph[] = []
  const fonts = new Map<string, FontMetrics | undefined>()
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
  return { ...vector, textColors: associateTextColors(items, glyphs), glyphSymbols: symbols }
}
