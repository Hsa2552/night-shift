// Chargement d'un PDF comme le fait l'application : texte lu par `readPageText` du module PDF,
// rendu raster à l'échelle 1 sur fond blanc (fabrique de canvas de pdf.js). Sous Node, le
// rendu exige `@napi-rs/canvas` (installé localement, hors dépendances) ; sinon, texte seul.

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { fitCanvas, MAX_RASTER_PIXELS } from '../../pdf/canvas-size.ts'
import { readPageText } from '../../pdf/read-text.ts'
import type { DetectionInput, PageData, RasterData } from '../contract.ts'

export interface LoadedDocument extends DetectionInput {
  /** Vrai si le rendu raster est disponible. */
  raster: boolean
  close(): Promise<void>
}

export const NODE_PDF_LOADER_VERSION = 'pdfjs-native-canvas/2'
const pdfjs = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'))
const asset = (directory: string) => join(pdfjs, directory).replaceAll('\\', '/') + '/'

export async function loadPdf(
  bytes: Uint8Array,
  options: { standardFontDataUrl?: string; raster?: boolean } = {},
): Promise<LoadedDocument> {
  const task = getDocument({
    data: bytes,
    standardFontDataUrl: options.standardFontDataUrl ?? asset('standard_fonts'),
    cMapUrl: asset('cmaps'),
    cMapPacked: true,
    wasmUrl: asset('wasm'),
    iccUrl: asset('iccs'),
    useSystemFonts: false,
  })
  try {
    return await preparePdf(task, options.raster !== false)
  } catch (error) {
    await task.destroy().catch(() => undefined)
    throw error
  }
}

async function preparePdf(
  task: ReturnType<typeof getDocument>,
  raster: boolean,
): Promise<LoadedDocument> {
  const doc = await task.promise
  const pages: PageData[] = []
  for (let p = 0; p < doc.numPages; p++) {
    const page = await doc.getPage(p + 1)
    const { width, height, transform } = page.getViewport({ scale: 1 })
    const textItems = await readPageText(page, transform, doc.isPureXfa)
    pages.push({ pageIndex: p, width, height, textItems })
  }
  const factory = doc.canvasFactory as {
    create(w: number, h: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }
    destroy(output: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }): void
  }
  if (raster) {
    try {
      factory.destroy(factory.create(1, 1))
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
            const { width, height } = fitCanvas(
              viewport.width,
              viewport.height,
              1,
              MAX_RASTER_PIXELS,
            )
            const output = factory.create(width, height)
            const { canvas, context } = output
            const transform = [width / viewport.width, 0, 0, height / viewport.height, 0, 0]
            try {
              await page.render({
                canvasContext: context,
                canvas,
                viewport,
                transform,
                background: '#fff',
              }).promise
              return { width, height, rgba: context.getImageData(0, 0, width, height).data }
            } finally {
              factory.destroy(output)
            }
          })()
          cache.set(pageIndex, r)
        }
        return r
      }
    : undefined
  return {
    pages,
    getRaster,
    raster,
    close: () => {
      cache.clear()
      return task.destroy()
    },
  }
}
