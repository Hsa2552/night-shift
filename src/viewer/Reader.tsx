import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import type { PdfDocument } from '../pdf'
import type { KeyboardEvent } from 'react'
import type { PageDimensions } from '../shared/types'
import { DocumentViewer } from './DocumentViewer'
import type { DocumentViewerHandle, ViewerMode } from './DocumentViewer'
import { PdfCanvas } from './PdfCanvas'
import type { ReaderPreferences } from './readerPreferences'

export type AnalysisProgress =
  { phase: 'extract'; extracted: number; total: number } | { phase: 'detect' }

type DetectionPresentationMode = Exclude<ViewerMode['kind'], 'covered'>

interface ReaderProps {
  pdf: PdfDocument
  pages: PageDimensions[]
  mode: ViewerMode
  analysis?: AnalysisProgress
  detectedMode?: DetectionPresentationMode
  replacing: boolean
  preferences: ReaderPreferences
  onPreferencesChange: (change: Partial<ReaderPreferences>) => void
  helpDismissed: boolean
  onHelpDismissed: () => void
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
  analysis,
  detectedMode,
  replacing,
  preferences,
  onPreferencesChange,
  helpDismissed,
  onHelpDismissed,
  status,
  kindLabel,
  warnings,
  error,
  onAnalyze,
  onProgressive,
  onCancel,
}: ReaderProps) {
  const [wide, setWide] = useState(() => window.matchMedia?.(wideReader).matches ?? false)
  const [activePage, setActivePage] = useState(0)
  const [revealed, setRevealed] = useState(0)
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement)
  const [helpRequested, setHelpRequested] = useState(false)
  const [mobileNavigationDismissed, setMobileNavigationDismissed] = useState(false)
  const { navigation, correctionSide, zoom } = preferences
  const showNavigation = (navigation ?? wide) && (wide || !mobileNavigationDismissed)
  const analyzing = analysis !== undefined
  const main = useRef<HTMLElement>(null)
  const toolbar = useRef<HTMLElement>(null)
  const navigationPanel = useRef<HTMLElement>(null)
  const helpPanel = useRef<HTMLElement>(null)
  const footer = useRef<HTMLElement>(null)
  const menu = useRef<HTMLDetailsElement>(null)
  const scrollArea = useRef<HTMLDivElement>(null)
  const viewer = useRef<DocumentViewerHandle>(null)
  const pendingPage = useRef<number | null>(null)
  const total = mode.kind === 'automatic' ? mode.blocks.length : 0
  const training = mode.kind === 'automatic' && total > 0
  const showHelp = helpRequested || (!helpDismissed && training)
  const automaticUnavailable = detectedMode === 'progressive'

  useLayoutEffect(() => {
    if (typeof HTMLElement.prototype.scrollIntoView === 'function') window.scrollTo(0, 0)
    main.current?.focus({ preventScroll: true })
  }, [])

  useLayoutEffect(() => {
    if (!helpRequested) return
    helpPanel.current?.scrollIntoView?.({ block: 'nearest' })
    helpPanel.current?.focus({ preventScroll: true })
  }, [helpRequested])

  useEffect(() => {
    const media = window.matchMedia?.(wideReader)
    const resize = () => setWide(media?.matches ?? false)
    media?.addEventListener('change', resize)
    return () => media?.removeEventListener('change', resize)
  }, [])

  useEffect(() => {
    const update = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])

  useEffect(() => {
    const panel = navigationPanel.current
    const active = panel?.querySelector('[aria-current="page"]')
    if (!panel || !active || !wide) return
    const outer = panel.getBoundingClientRect()
    const inner = active.getBoundingClientRect()
    panel.scrollTop +=
      inner.top < outer.top ? inner.top - outer.top : Math.max(0, inner.bottom - outer.bottom)
  }, [activePage, showNavigation, wide])

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
      const atEnd =
        window.scrollY > 0 &&
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
      setActivePage(atEnd ? Math.max(0, sheets.length - 1) : Math.max(0, start - 1))
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
    if (!wide && showNavigation) {
      pendingPage.current = page
      setMobileNavigationDismissed(true)
    } else {
      scrollArea.current
        ?.querySelector<HTMLElement>('[data-reader-page="' + page + '"]')
        ?.scrollIntoView?.({ block: 'start', inline: 'nearest' })
    }
    setActivePage(page)
  }

  function currentSheet() {
    return scrollArea.current?.querySelector<HTMLElement>(
      '[data-reader-page="' + activePage + '"] .pdf-viewer-page',
    )
  }

  function adjustZoom(value: number) {
    const focused = currentSheet()
    const before = focused?.getBoundingClientRect()
    const scroller = focused?.parentElement
    const frame = scroller?.getBoundingClientRect()
    const viewTop = toolbar.current?.getBoundingClientRect().bottom ?? 0
    const viewBottom = footer.current?.getBoundingClientRect().top ?? window.innerHeight
    const centerY = (viewTop + viewBottom) / 2
    const centerX = frame ? frame.left + frame.width / 2 : 0
    onPreferencesChange({ zoom: value })
    if (!focused || !before?.height || !scroller) return

    const fractionY = Math.min(1, Math.max(0, (centerY - before.top) / before.height))
    const fractionX = Math.min(1, Math.max(0, (centerX - before.left) / before.width))
    requestAnimationFrame(() => {
      if (!focused.isConnected) return
      const after = focused.getBoundingClientRect()
      const deltaY = after.top - before.top + fractionY * (after.height - before.height)
      const deltaX = after.left - before.left + fractionX * (after.width - before.width)
      if (deltaY) window.scrollBy(0, deltaY)
      if (deltaX) scroller.scrollLeft += deltaX
    })
  }

  function fitHeight() {
    const height = currentSheet()?.getBoundingClientRect().height
    if (!height) return
    const top = toolbar.current?.getBoundingClientRect().bottom ?? 0
    const bottom = footer.current?.getBoundingClientRect().top ?? window.innerHeight
    const value = Math.round((zoom * Math.max(1, bottom - top - 20)) / height)
    adjustZoom(Math.max(25, Math.min(200, value)))
  }

  function toggleFullscreen() {
    const action = document.fullscreenElement
      ? document.exitFullscreen?.()
      : document.documentElement.requestFullscreen?.()
    void action?.catch(() => undefined)
  }

  function runTool(action: () => void) {
    if (menu.current) {
      menu.current.open = false
      menu.current.querySelector('summary')?.focus({ preventScroll: true })
    }
    action()
  }

  function handleShortcut(event: KeyboardEvent<HTMLElement>) {
    if (
      event.defaultPrevented ||
      !event.altKey ||
      !event.shiftKey ||
      event.metaKey ||
      event.ctrlKey ||
      (event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, [contenteditable]'))
    )
      return

    const actions: Record<string, () => void> = {
      pageup: () => navigate(Math.max(0, activePage - 1)),
      pagedown: () => navigate(Math.min(pages.length - 1, activePage + 1)),
      arrowup: () => viewer.current?.navigateCorrection('previous'),
      arrowdown: () => viewer.current?.navigateCorrection('next'),
      r: () => viewer.current?.remaskAll(),
    }
    const action = actions[event.key.toLowerCase()]
    if (!action) return
    event.preventDefault()
    action()
  }

  return (
    <main
      ref={main}
      id="main-content"
      className="reader"
      data-correction-side={correctionSide}
      tabIndex={-1}
      onKeyDown={handleShortcut}
    >
      <section className="reader-toolbar" ref={toolbar} aria-label="Outils de lecture">
        <div className="reader-toolbar-inner">
          <div className="reader-modes">
            <button
              type="button"
              className={'ui-button' + (mode.kind === 'covered' ? ' ui-primary' : '')}
              aria-pressed={mode.kind === 'automatic'}
              disabled={
                analyzing || automaticUnavailable || (mode.kind === 'automatic' && revealed === 0)
              }
              onClick={mode.kind === 'automatic' ? () => viewer.current?.remaskAll() : onAnalyze}
              title={
                automaticUnavailable
                  ? 'Ce PDF est disponible en révélation progressive.'
                  : training && revealed === 0
                    ? 'Toutes les corrections sont masquées'
                    : undefined
              }
            >
              <Icon name="eye-off" size={17} />
              <span>
                {training
                  ? 'Tout remasquer'
                  : mode.kind === 'progressive' && detectedMode === 'automatic'
                    ? 'Mode entraînement'
                    : 'Masquer les corrigés'}
              </span>
            </button>
            {training && (
              <button
                type="button"
                className="ui-button"
                disabled={revealed === total}
                onClick={() => viewer.current?.revealAll()}
                title="Afficher toutes les corrections"
              >
                <Icon name="eye" size={17} />
                <span>Tout afficher</span>
              </button>
            )}
            <button
              type="button"
              className="ui-button"
              aria-pressed={mode.kind === 'progressive'}
              onClick={onProgressive}
            >
              <Icon name="sliders" size={17} /> <span>Révélation progressive</span>
            </button>
            {training && (
              <button
                type="button"
                className="ui-button reader-reveal-all"
                aria-haspopup="dialog"
                disabled={revealed === total}
                onClick={() => {
                  if (window.confirm('Révéler toutes les corrections détectées ?'))
                    viewer.current?.revealAll()
                }}
              >
                <Icon name="eye" size={17} /> <span>Tout révéler</span>
              </button>
            )}
          </div>
          <div className="reader-tools">
            <button
              type="button"
              className="icon-button"
              title="Navigation par page"
              aria-label="Navigation par page"
              aria-controls={showNavigation ? 'reader-navigation' : undefined}
              aria-expanded={showNavigation}
              onClick={() => {
                setMobileNavigationDismissed(false)
                onPreferencesChange({ navigation: !showNavigation })
              }}
            >
              <Icon name="pages" />
            </button>
            <div className="reader-zoom" role="group" aria-label="Zoom du PDF">
              <button
                type="button"
                className="icon-button"
                title="Zoom arrière"
                aria-label="Zoom arrière"
                disabled={zoom <= 25}
                onClick={() => adjustZoom(Math.max(25, zoom - 25))}
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
                onClick={() => adjustZoom(Math.min(200, zoom + 25))}
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
            <details className="reader-menu" ref={menu}>
              <summary
                className="icon-button"
                aria-label="Outils et raccourcis"
                title="Outils et raccourcis"
              >
                <Icon name="more" />
              </summary>
              <div className="reader-menu-panel">
                {training && (
                  <div
                    className="reader-menu-actions"
                    role="group"
                    aria-label="Navigation entre les corrections"
                  >
                    <button
                      type="button"
                      onClick={() => runTool(() => viewer.current?.navigateCorrection('previous'))}
                    >
                      Correction précédente
                    </button>
                    <button
                      type="button"
                      onClick={() => runTool(() => viewer.current?.navigateCorrection('next'))}
                    >
                      Correction suivante
                    </button>
                    <button
                      type="button"
                      disabled={revealed === total}
                      onClick={() =>
                        runTool(() => viewer.current?.navigateCorrection('unrevealed'))
                      }
                    >
                      Prochain corrigé à découvrir
                    </button>
                  </div>
                )}
                <div className="reader-menu-actions">
                  <button type="button" onClick={() => runTool(fitHeight)}>
                    Ajuster à la hauteur
                  </button>
                  <button
                    type="button"
                    className="reader-correction-side"
                    aria-pressed={correctionSide === 'left'}
                    onClick={() =>
                      runTool(() =>
                        onPreferencesChange({
                          correctionSide: correctionSide === 'left' ? 'right' : 'left',
                        }),
                      )
                    }
                  >
                    Commandes à gauche
                  </button>
                  <button type="button" onClick={() => runTool(() => setHelpRequested(true))}>
                    Aide du lecteur
                  </button>
                  {document.fullscreenEnabled && (
                    <button type="button" onClick={() => runTool(toggleFullscreen)}>
                      {fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                    </button>
                  )}
                </div>
                <div className="reader-shortcuts">
                  <p>Raccourcis dans le lecteur</p>
                  <span>Alt + Maj + Page haut / bas — pages</span>
                  <span>Alt + Maj + ↑ / ↓ — corrections</span>
                  <span>Alt + Maj + R — tout remasquer</span>
                  <span>Entrée ou Espace — activer le bouton ciblé</span>
                </div>
              </div>
            </details>
          </div>
        </div>
      </section>

      <div className="reader-layout" data-navigation={showNavigation || undefined}>
        {showNavigation && (
          <nav
            ref={navigationPanel}
            id="reader-navigation"
            className="reader-navigation"
            aria-label="Pages du PDF"
          >
            <h2>Pages</h2>
            {pages.length > 8 && (
              <form
                className="reader-page-jump"
                onSubmit={(event) => {
                  event.preventDefault()
                  const value = Number(new FormData(event.currentTarget).get('page'))
                  if (Number.isInteger(value) && value >= 1 && value <= pages.length)
                    navigate(value - 1)
                }}
              >
                <input
                  type="number"
                  name="page"
                  min={1}
                  max={pages.length}
                  step={1}
                  required
                  placeholder="Page"
                  aria-label="Numéro de page"
                />
                <button type="submit">Aller</button>
              </form>
            )}
            <ol>
              {pages.map(({ pageIndex, width, height }) => (
                <li key={pageIndex}>
                  <button
                    type="button"
                    aria-label={'Aller à la page ' + (pageIndex + 1)}
                    aria-current={activePage === pageIndex ? 'page' : undefined}
                    onClick={() => navigate(pageIndex)}
                  >
                    <span
                      className="page-tile"
                      aria-hidden="true"
                      style={{ aspectRatio: width / height }}
                    />
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
              {(analysis?.phase === 'detect' || (replacing && !analyzing)) && (
                <span className="loading-ring" aria-hidden="true" />
              )}
              <div>
                {(training || kindLabel) && (
                  <p className="reader-mode-label">{training ? 'Mode entraînement' : kindLabel}</p>
                )}
                {training && kindLabel === 'Corrigé seul' && <p>{kindLabel}</p>}
                <p role={analysis?.phase === 'extract' ? undefined : 'status'}>{status}</p>
                {analysis && (
                  <progress
                    className="reader-analysis-progress"
                    aria-label="Progression de l’analyse"
                    aria-valuetext={status}
                    value={analysis.phase === 'extract' ? analysis.extracted : undefined}
                    max={analysis.phase === 'extract' ? analysis.total : 1}
                  />
                )}
              </div>
              {analyzing && (
                <button type="button" className="ui-button" onClick={onCancel}>
                  Annuler l’analyse
                </button>
              )}
            </div>
            {showHelp && (
              <aside
                ref={helpPanel}
                className="reader-help"
                aria-label="Aide du lecteur"
                tabIndex={-1}
              >
                <p>
                  Clique dans le PDF ou utilise les boutons de correction. « Tout remasquer »
                  recouvre les réponses. Le menu permet de passer à la correction suivante. En
                  lecture progressive, déplace le trait.
                </p>
                <button
                  type="button"
                  className="icon-button"
                  title="Fermer l’aide"
                  aria-label="Fermer l’aide"
                  onClick={() => {
                    setHelpRequested(false)
                    onHelpDismissed()
                    menu.current?.querySelector('summary')?.focus({ preventScroll: true })
                  }}
                >
                  <Icon name="close" size={16} />
                </button>
              </aside>
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
          <div ref={scrollArea} className="reader-scroll">
            <div className="reader-document">
              <DocumentViewer
                ref={viewer}
                pages={pages}
                mode={mode}
                workspace
                zoom={zoom}
                onRevealedCount={setRevealed}
                renderPage={(page) => <PdfCanvas pdf={pdf} page={page} />}
              />
            </div>
          </div>
        </div>
      </div>
      <footer ref={footer} className="reader-progress" aria-label="Progression de lecture">
        <span
          className="reader-page-count"
          aria-label={'Page ' + (activePage + 1) + ' sur ' + pages.length}
        >
          Page {activePage + 1} / {pages.length}
        </span>
        {training ? (
          <>
            <span aria-live="polite">
              {Math.min(revealed, total)} / {total}{' '}
              {total === 1 ? 'correction révélée' : 'corrections révélées'}
            </span>
            <progress aria-label="Corrections révélées" value={revealed} max={total} />
          </>
        ) : (
          <span>
            {analyzing
              ? 'Analyse en cours'
              : mode.kind === 'progressive'
                ? 'Lecture progressive'
                : mode.kind === 'automatic'
                  ? 'Sujet sans correction détectée'
                  : 'Document couvert'}
          </span>
        )}
      </footer>
    </main>
  )
}
