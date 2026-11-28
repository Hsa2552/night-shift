// Chargement d'un PDF comme le fait l'application : texte lu par `readPageText` du module PDF,
// rendu raster à l'échelle 1 sur fond blanc (fabrique de canvas de pdf.js). Sous Node, le
// rendu exige `@napi-rs/canvas` (installé localement, hors dépendances) ; sinon, texte seul.

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readPageText } from '../../pdf/read-text.ts'
import type { DetectionInput, PageData, RasterData } from '../contract.ts'

export interface LoadedDocument extends DetectionInput {
  /** Vrai si le rendu raster est disponible. */
  raster: boolean
  close(): Promise<void>
}

export async function loadPdf(
  bytes: Uint8Array,
  options: { standardFontDataUrl?: string; raster?: boolean } = {},
): Promise<LoadedDocument> {
  const task = getDocument({
    data: bytes,
    standardFontDataUrl: options.standardFontDataUrl,
    useSystemFonts: false,
  })
  const doc = await task.promise
  const pages: PageData[] = []
  for (let p = 0; p < doc.numPages; p++) {
    const page = await doc.getPage(p + 1)
    const { width, height, transform } = page.getViewport({ scale: 1 })
    const textItems = await readPageText(page, transform, false)
    pages.push({ pageIndex: p, width, height, textItems })
  }
  const factory = doc.canvasFactory as {
    create(w: number, h: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }
  }
  let raster = options.raster !== false
  if (raster) {
    try {
      factory.create(1, 1)
    } catch {
      raster = false
    }
  }
  const cache = new Map<number, Promise<RasterData>>()
  const getRaster = raster
    ? (pageIndex: number): Promise<RasterData> => {
        let r = cache.get(pageIndex)
        if (!r) {
          r = (async () => {
            const page = await doc.getPage(pageIndex + 1)
            const viewport = page.getViewport({ scale: 1 })
            const { canvas, context } = factory.create(
              Math.round(viewport.width),
              Math.round(viewport.height),
            )
            await page.render({ canvasContext: context, canvas, viewport, background: '#fff' })
              .promise
            const { width, height } = canvas
            return { width, height, rgba: context.getImageData(0, 0, width, height).data }
          })()
          cache.set(pageIndex, r)
        }
        return r
      }
    : undefined
  return { pages, getRaster, raster, close: () => task.destroy() }
}
