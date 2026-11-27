import { memo, useEffect, useRef, useState } from 'react'
import type { PdfDocument } from '../pdf'
import type { PageDimensions } from '../shared/types'

export const PdfCanvas = memo(function PdfCanvas({
  pdf,
  page,
}: {
  pdf: PdfDocument
  page: PageDimensions
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    if (!canvas || !container) return
    let controller: AbortController | undefined
    let previousWidth = 0
    let previousRatio = 0
    let nearby = false

    function redraw() {
      if (!nearby || !canvas || !container) return
      const width = container.getBoundingClientRect().width
      const pixelRatio = window.devicePixelRatio || 1
      if (width === 0 || (width === previousWidth && pixelRatio === previousRatio)) return
      previousWidth = width
      previousRatio = pixelRatio
      controller?.abort()
      controller = new AbortController()
      const { signal } = controller
      void pdf
        .renderPage(page.pageIndex, canvas, { width, pixelRatio, signal })
        .then(() => {
          if (!signal.aborted) setError(false)
        })
        .catch(() => {
          if (signal.aborted) return
          canvas.width = 0
          setError(true)
        })
    }

    const resize = new ResizeObserver(redraw)
    resize.observe(container)
    window.addEventListener('resize', redraw)
    const visibility = new IntersectionObserver(
      ([entry]) => {
        nearby = entry.isIntersecting
        if (nearby) {
          redraw()
        } else if (controller) {
          controller.abort()
          controller = undefined
          previousWidth = 0
          canvas.width = 0
          canvas.height = 0
        }
      },
      { rootMargin: '400px 0px' },
    )
    visibility.observe(container)
    return () => {
      controller?.abort()
      resize.disconnect()
      visibility.disconnect()
      window.removeEventListener('resize', redraw)
    }
  }, [pdf, page.pageIndex])

  return (
    <>
      <canvas ref={canvasRef} width={0} height={0} aria-hidden="true" />
      {error && (
        <p className="pdf-viewer-render-error" role="status">
          Impossible d’afficher cette page.
        </p>
      )}
    </>
  )
})
