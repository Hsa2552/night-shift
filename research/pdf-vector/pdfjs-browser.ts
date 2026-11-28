import { GlobalWorkerOptions, getDocument, version } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { observeVectorPage } from '../../src/detection/visual/vector'
import { nativeSquares } from '../../src/detection/visual/vector/cases'
import { observeNativePage } from '../../src/detection/visual/vector/native-page'
import { readPageText } from '../../src/pdf/read-text'
import { observePageInk } from '../../src/detection/visual/inkObservation'

GlobalWorkerOptions.workerSrc = workerUrl

// Lab-only opener. PDFPageProxy stays outside the production reader's contract.
export async function measure(bytes: Uint8Array<ArrayBuffer>, nativeText = false) {
  const asset = (name: string) =>
    new URL('/node_modules/pdfjs-dist/' + name + '/', location.href).href
  const task = getDocument({
    data: bytes,
    cMapUrl: asset('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: asset('standard_fonts'),
    wasmUrl: asset('wasm'),
    iccUrl: asset('iccs'),
  })
  try {
    const document = await task.promise
    const pages = []
    for (let pageIndex = 0; pageIndex < document.numPages; pageIndex++) {
      const page = await document.getPage(pageIndex + 1)
      if (nativeText) {
        const viewport = page.getViewport({ scale: 1 })
        const textItems = await readPageText(page, viewport.transform, document.isPureXfa)
        const start = performance.now()
        const { glyphSymbols, textColors } = await observeNativePage(page, textItems)
        const ms = performance.now() - start
        const canvas = window.document.createElement('canvas')
        const rasterScale = Math.min(
          1.35,
          Math.sqrt(5_000_000 / (viewport.width * viewport.height)),
        )
        const rasterViewport = page.getViewport({ scale: rasterScale })
        canvas.width = Math.max(1, Math.ceil(rasterViewport.width))
        canvas.height = Math.max(1, Math.ceil(rasterViewport.height))
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('Canvas 2D unavailable')
        const renderStart = performance.now()
        await page.render({ canvas, canvasContext: ctx, viewport: rasterViewport }).promise
        const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        const renderMs = performance.now() - renderStart
        const rasterStart = performance.now()
        const rasterInk = observePageInk(
          { pageIndex, width: viewport.width, height: viewport.height, textItems },
          { width: canvas.width, height: canvas.height, rgba },
        )
        // This mode includes reference text for a local comparison. Never publish its output.
        pages.push({
          pageIndex,
          textItems,
          textColors,
          glyphSymbols,
          ms,
          renderMs,
          rasterMs: performance.now() - rasterStart,
          rasterInk: rasterInk?.text,
        })
        canvas.width = canvas.height = 0
        continue
      }
      const start = performance.now()
      const observation = await observeVectorPage(page)
      const cases = nativeSquares(observation.rectangles).map(
        ({ region: { bbox }, nativeState }) => ({
          bbox: [bbox.x, bbox.y, bbox.width, bbox.height],
          state: nativeState,
        }),
      )
      pages.push({ ...observation, cases, ms: performance.now() - start })
    }
    return { pdfjsVersion: version, pages }
  } finally {
    await task.destroy()
  }
}
