import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type { PageData, RasterData } from '../shared/types'
import { mapTextItem } from './text-geometry'

export type { PageData, RasterData, Rect, TextItem } from '../shared/types'

export interface RenderPageOptions {
  /** Desired width in CSS pixels. Defaults to the page width at scale 1. */
  width?: number
  /** Canvas pixels per CSS pixel. Defaults to devicePixelRatio. */
  pixelRatio?: number
  signal?: AbortSignal
}

export interface PdfDocument {
  readonly pageCount: number
  getPageData(pageIndex: number): Promise<PageData>
  renderPage(
    pageIndex: number,
    canvas: HTMLCanvasElement,
    options?: RenderPageOptions,
  ): Promise<void>
  getRaster(pageIndex: number): Promise<RasterData>
  close(): Promise<void>
}

if (typeof window !== 'undefined') GlobalWorkerOptions.workerSrc = workerUrl

export async function openPdf(file: Blob): Promise<PdfDocument> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const assetRoot = import.meta.env.DEV ? 'node_modules/pdfjs-dist/' : 'pdfjs/'
  const assetUrl = (directory: string) =>
    typeof window === 'undefined'
      ? undefined
      : new URL(`${import.meta.env.BASE_URL}${assetRoot}${directory}/`, window.location.href).href

  const task = getDocument({
    data: bytes,
    cMapUrl: assetUrl('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: assetUrl('standard_fonts'),
    wasmUrl: assetUrl('wasm'),
    iccUrl: assetUrl('iccs'),
  })

  const document = await task.promise.catch(async (error: unknown) => {
    await task.destroy().catch(() => undefined)
    throw error
  })

  let closing: Promise<void> | undefined
  const rendering = new WeakMap<HTMLCanvasElement, { cancel(): void; promise: Promise<unknown> }>()

  async function getPage(pageIndex: number) {
    if (closing) throw new Error('Le PDF est fermé.')
    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= document.numPages) {
      throw new RangeError('Indice de page hors limites.')
    }
    return document.getPage(pageIndex + 1)
  }

  async function renderPage(
    pageIndex: number,
    canvas: HTMLCanvasElement,
    { width, pixelRatio = globalThis.devicePixelRatio || 1, signal }: RenderPageOptions = {},
  ) {
    signal?.throwIfAborted()
    const page = await getPage(pageIndex)
    const original = page.getViewport({ scale: 1 })
    const cssWidth = width ?? original.width
    if (![cssWidth, pixelRatio].every((value) => Number.isFinite(value) && value > 0)) {
      throw new RangeError('La largeur et la densité du rendu doivent être positives et finies.')
    }
    let previous = rendering.get(canvas)
    while (previous) {
      previous.cancel()
      await previous.promise.catch(() => undefined)
      if (rendering.get(canvas) === previous) rendering.delete(canvas)
      previous = rendering.get(canvas)
    }
    signal?.throwIfAborted()
    if (closing) throw new Error('Le PDF est fermé.')

    const viewport = page.getViewport({ scale: cssWidth / original.width })
    canvas.width = Math.max(1, Math.round(viewport.width * pixelRatio))
    canvas.height = Math.max(1, Math.round(viewport.height * pixelRatio))
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    // Match both canvas edges despite rounding the physical dimensions to whole pixels.
    const transform = [canvas.width / viewport.width, 0, 0, canvas.height / viewport.height, 0, 0]
    const render = page.render({ canvas, viewport, transform, background: '#fff' })
    rendering.set(canvas, render)
    const cancel = () => render.cancel()
    signal?.addEventListener('abort', cancel, { once: true })
    try {
      await render.promise
    } finally {
      signal?.removeEventListener('abort', cancel)
      if (rendering.get(canvas) === render) rendering.delete(canvas)
    }
  }

  return {
    pageCount: document.numPages,
    async getPageData(pageIndex) {
      const page = await getPage(pageIndex)
      const { width, height, transform } = page.getViewport({ scale: 1 })
      const { items, styles } = await page.getTextContent()
      const textItems = items.flatMap((item) =>
        'str' in item ? [mapTextItem(item, styles[item.fontName], transform)] : [],
      )
      return { pageIndex, width, height, textItems }
    },
    renderPage,
    async getRaster(pageIndex) {
      const canvas = globalThis.document.createElement('canvas')
      try {
        await renderPage(pageIndex, canvas, { pixelRatio: 1 })
        const { width, height } = canvas
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Le contexte canvas 2D est indisponible.')
        return { width, height, rgba: context.getImageData(0, 0, width, height).data }
      } finally {
        canvas.width = 0
        canvas.height = 0
      }
    },
    close() {
      closing ??= task.destroy()
      return closing
    },
  }
}
