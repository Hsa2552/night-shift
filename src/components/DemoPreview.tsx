import { useEffect, useRef, useState } from 'react'
import pdfUrl from '../assets/exemple-synthetique.pdf?inline'
import type { PdfDocument } from '../pdf'
import { DocumentViewer } from '../viewer/DocumentViewer'
import type { ViewerMode } from '../viewer/DocumentViewer'
import { PdfCanvas } from '../viewer/PdfCanvas'
import { Icon } from './Icon'

const pages = [{ pageIndex: 0, width: 560, height: 496 }]
const mode: ViewerMode = {
  kind: 'automatic',
  blocks: [
    {
      id: 'demo-1',
      questionLabel: 'Lancer un dé',
      regions: [{ pageIndex: 0, bbox: { x: 48, y: 250, width: 464, height: 84 } }],
    },
    {
      id: 'demo-2',
      questionLabel: 'Deux lancers indépendants',
      regions: [{ pageIndex: 0, bbox: { x: 48, y: 432, width: 464, height: 44 } }],
    },
  ],
}

export function DemoPreview() {
  const ref = useRef<HTMLElement>(null)
  const [pdf, setPdf] = useState<PdfDocument>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const frame = ref.current
    if (!frame || typeof IntersectionObserver === 'undefined') return
    let active = true
    let opened: PdfDocument | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        void Promise.all([import('../pdf'), fetch(pdfUrl).then((response) => response.blob())])
          .then(async ([{ openPdf }, blob]) => {
            if (!active) return
            opened = await openPdf(blob)
            if (active) setPdf(opened)
            else await opened.close()
          })
          .catch(() => {
            if (active) setFailed(true)
          })
      },
      { rootMargin: '120px' },
    )
    observer.observe(frame)
    return () => {
      active = false
      observer.disconnect()
      if (opened) void opened.close().catch(() => undefined)
    }
  }, [])

  return (
    <figure ref={ref} className="demo-preview" aria-labelledby="demo-caption">
      <figcaption id="demo-caption">
        <span>
          <Icon name="file" size={16} /> Exemple synthétique
        </span>
        <span className="demo-format">PDF</span>
      </figcaption>
      {pdf ? (
        <DocumentViewer
          pages={pages}
          mode={mode}
          renderPage={(page) => <PdfCanvas pdf={pdf} page={page} />}
        />
      ) : (
        <div className="demo-placeholder" role="status">
          {failed ? (
            'L’aperçu est indisponible.'
          ) : (
            <span className="loading-ring" aria-label="Ouverture de l’exemple" />
          )}
        </div>
      )}
    </figure>
  )
}
