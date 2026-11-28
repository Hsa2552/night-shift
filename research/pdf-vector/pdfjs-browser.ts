import { GlobalWorkerOptions, getDocument, version } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { observeVectorPage } from '../../src/detection/visual/vector'
import { nativeSquares } from '../../src/detection/visual/vector/cases'

GlobalWorkerOptions.workerSrc = workerUrl

// Lab-only opener. PDFPageProxy stays outside the production reader's contract.
export async function measure(bytes: Uint8Array<ArrayBuffer>) {
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
