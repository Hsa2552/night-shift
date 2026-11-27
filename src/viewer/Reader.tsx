import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import type { PdfDocument } from '../pdf'
import type { PageDimensions } from '../shared/types'
import { DocumentViewer } from './DocumentViewer'
import type { ViewerMode } from './DocumentViewer'
import { PdfCanvas } from './PdfCanvas'

interface ReaderProps {
  pdf: PdfDocument
  pages: PageDimensions[]
  mode: ViewerMode
  analyzing: boolean
  status: string
  kindLabel: string
  warnings: string[]
  error: string
  onAnalyze: () => void
  onProgressive: () => void
  onCancel: () => void
}

const wideReader = '(min-width: 900px)'

export function Reader({
  pdf,
  pages,
  mode,
  analyzing,
  status,
  kindLabel,
  warnings,
  error,
  onAnalyze,
  onProgressive,
  onCancel,
}: ReaderProps) {
  const [wide, setWide] = useState(() => window.matchMedia?.(wideReader).matches ?? false)
  const [navigation, setNavigation] = useState<boolean | null>(null)
  const [activePage, setActivePage] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [revealed, setRevealed] = useState(0)
  const showNavigation = navigation ?? wide
  const main = useRef<HTMLElement>(null)
  const toolbar = useRef<HTMLElement>(null)
  const scrollArea = useRef<HTMLDivElement>(null)
  const pendingPage = useRef<number | null>(null)
  const total = mode.kind === 'automatic' ? mode.blocks.length : 0

  useLayoutEffect(() => {
    if (typeof HTMLElement.prototype.scrollIntoView === 'function') window.scrollTo(0, 0)
    main.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const media = window.matchMedia?.(wideReader)
    const resize = () => setWide(media?.matches ?? false)
    media?.addEventListener('change', resize)
    return () => media?.removeEventListener('change', resize)
  }, [])

  useLayoutEffect(() => {
    if (pendingPage.current === null) return
    const page = pendingPage.current
    pendingPage.current = null
    scrollArea.current
      ?.querySelector<HTMLElement>('[data-reader-page="' + page + '"]')
      ?.scrollIntoView?.({ block: 'start', inline: 'nearest' })
  }, [activePage, showNavigation])

  useEffect(() => {
    const stage = scrollArea.current
    if (!stage) return
    const sheets = stage.querySelectorAll<HTMLElement>('[data-reader-page]')
    let frame: number | undefined
    function update() {
      frame = undefined
      const anchor = Math.max(toolbar.current?.getBoundingClientRect().bottom ?? 0, 0) + 96
      let start = 0
      let end = sheets.length
      while (start < end) {
        const middle = Math.floor((start + end) / 2)
        if (sheets[middle].getBoundingClientRect().top <= anchor) start = middle + 1
        else end = middle
      }
      setActivePage(Math.max(0, start - 1))
    }
    const queue = () => {
      frame ??= requestAnimationFrame(update)
    }
    window.addEventListener('scroll', queue, { passive: true })
    window.addEventListener('resize', queue)
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', queue)
      window.removeEventListener('resize', queue)
    }
  }, [pages])

  function navigate(page: number) {
    if (page === activePage && wide) {
      scrollArea.current
        ?.querySelector<HTMLElement>('[data-reader-page="' + page + '"]')
        ?.scrollIntoView?.({ block: 'start' })
      return
    }
    pendingPage.current = page
    if (!wide) setNavigation(false)
    setActivePage(page)
  }

  function adjustZoom(value: number) {
    const focused = scrollArea.current?.querySelector<HTMLElement>(
      '[data-reader-page="' + activePage + '"]',
    )
    const oldTop = focused?.getBoundingClientRect().top
    setZoom(value)
    if (oldTop !== undefined) {
      requestAnimationFrame(() => {
        if (focused?.isConnected) window.scrollBy(0, focused.getBoundingClientRect().top - oldTop)
      })
    }
  }

  return (
    <main ref={main} id="main-content" className="reader" tabIndex={-1}>
      <section className="reader-toolbar" ref={toolbar} aria-label="Outils de lecture">
        <div className="reader-toolbar-inner">
          <div className="reader-modes">
            <button
              type="button"
              className={'ui-button' + (mode.kind === 'covered' ? ' ui-primary' : '')}
              aria-pressed={mode.kind === 'automatic'}
              disabled={analyzing || mode.kind === 'automatic'}
              onClick={onAnalyze}
            >
              <Icon name="eye-off" size={17} /> <span>Masquer les corrigés</span>
            </button>
            <button
              type="button"
              className="ui-button"
              aria-pressed={mode.kind === 'progressive'}
              onClick={onProgressive}
            >
              <Icon name="sliders" size={17} /> <span>Révélation progressive</span>
            </button>
          </div>
          <div className="reader-tools">
            <button
              type="button"
              className="icon-button"
              title="Navigation par page"
              aria-label="Navigation par page"
              aria-controls={showNavigation ? 'reader-navigation' : undefined}
              aria-expanded={showNavigation}
              onClick={() => setNavigation(!showNavigation)}
            >
              <Icon name="pages" />
            </button>
            <span
              className="reader-page-count"
              aria-label={'Page ' + (activePage + 1) + ' sur ' + pages.length}
            >
              {activePage + 1} / {pages.length}
            </span>
            <div className="reader-zoom" role="group" aria-label="Zoom du PDF">
              <button
                type="button"
                className="icon-button"
                title="Zoom arrière"
                aria-label="Zoom arrière"
                disabled={zoom <= 75}
                onClick={() => adjustZoom(zoom - 25)}
              >
                <Icon name="minus" size={17} />
              </button>
              <span aria-live="polite">{zoom} %</span>
              <button
                type="button"
                className="icon-button"
                title="Zoom avant"
                aria-label="Zoom avant"
                disabled={zoom >= 200}
                onClick={() => adjustZoom(zoom + 25)}
              >
                <Icon name="plus" size={17} />
              </button>
              <button
                type="button"
                className="icon-button"
                title="Ajuster à la largeur"
                aria-label="Ajuster à la largeur"
                onClick={() => adjustZoom(100)}
              >
                <Icon name="fit" size={17} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="reader-layout" data-navigation={showNavigation || undefined}>
        {showNavigation && (
          <nav id="reader-navigation" className="reader-navigation" aria-label="Pages du PDF">
            <h2>Pages</h2>
            <ol>
              {pages.map(({ pageIndex }) => (
                <li key={pageIndex}>
                  <button
                    type="button"
                    aria-label={'Aller à la page ' + (pageIndex + 1)}
                    aria-current={activePage === pageIndex ? 'page' : undefined}
                    onClick={() => navigate(pageIndex)}
                  >
                    <span className="page-tile" aria-hidden="true">
                      <Icon name="file" size={20} />
                    </span>
                    <span>{pageIndex + 1}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="reader-main">
          <section className="reader-status" aria-label="État du document">
            <div className="reader-status-copy">
              {analyzing && <span className="loading-ring" aria-hidden="true" />}
              <div>
                {kindLabel && <p className="reader-mode-label">{kindLabel}</p>}
                <p role="status">{status}</p>
              </div>
              {analyzing && (
                <button type="button" className="ui-button" onClick={onCancel}>
                  Annuler l’analyse
                </button>
              )}
            </div>
            {total > 0 && (
              <div className="reader-progress">
                <span aria-live="polite">
                  {Math.min(revealed, total)} / {total} corrections révélées
                </span>
                <progress aria-label="Corrections révélées" value={revealed} max={total} />
              </div>
            )}
            {error && (
              <p className="ui-error" role="alert">
                <Icon name="alert" size={17} /> {error}
              </p>
            )}
            {warnings.length > 0 && (
              <ul className="reader-warnings">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            )}
          </section>
          <div
            ref={scrollArea}
            className="reader-scroll"
            tabIndex={zoom > 100 ? 0 : undefined}
            aria-label="Document zoomable"
          >
            <div
              className="reader-document"
              style={{ width: zoom + '%', maxWidth: (56 * zoom) / 100 + 'rem' }}
            >
              <DocumentViewer
                pages={pages}
                mode={mode}
                onRevealedCount={setRevealed}
                renderPage={(page) => <PdfCanvas pdf={pdf} page={page} />}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
