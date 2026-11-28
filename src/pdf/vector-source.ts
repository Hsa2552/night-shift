import type { PDFPageProxy } from 'pdfjs-dist'
import type { TextItem, VectorPageObservation } from '../shared/types.ts'

type VectorPage = Pick<
  PDFPageProxy,
  'pageNumber' | 'getViewport' | 'getOperatorList' | 'cleanup' | 'commonObjs' | 'getAnnotations'
>

export function createVectorSource<Page extends VectorPage>(
  pageCount: number,
  getPage: (index: number) => Promise<Page>,
  getItems: (page: Page, index: number) => Promise<readonly TextItem[]>,
) {
  let closed = false
  const pending = new Map<number, Promise<VectorPageObservation | undefined>>()

  return {
    async getVectors(index: number): Promise<VectorPageObservation | undefined> {
      if (!Number.isInteger(index) || index < 0 || index >= pageCount) {
        throw new RangeError('Indice de page hors limites.')
      }
      if (closed) return undefined
      const existing = pending.get(index)
      if (existing) return existing

      const request = (async () => {
        const { observeNativePage } = await import('../detection/visual/vector/native-page.ts')
        if (closed) return undefined
        const page = await getPage(index)
        if (closed) return undefined
        try {
          const items = await getItems(page, index)
          if (closed) return undefined
          const observation = await observeNativePage(page, items)
          return closed ? undefined : observation
        } finally {
          // PDF.js waits for active render tasks before releasing the operator list.
          page.cleanup()
        }
      })()
        .catch(() => undefined)
        .finally(() => pending.delete(index))
      pending.set(index, request)
      return request
    },
    close() {
      closed = true
      pending.clear()
    },
  }
}
