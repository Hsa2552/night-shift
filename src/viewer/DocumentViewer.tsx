import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../components/Icon'
import type { CorrectionBlock, PageDimensions, PageRegion } from '../shared/types'
import { useProgressiveReveal } from './useProgressiveReveal'

export type ViewerMode =
  | { kind: 'covered' }
  | { kind: 'progressive' }
  | { kind: 'automatic'; blocks: readonly CorrectionBlock[] }

interface DocumentViewerProps {
  pages: readonly PageDimensions[]
  mode: ViewerMode
  renderPage: (page: PageDimensions) => ReactNode
  onRevealedCount?: (count: number) => void
}

interface BlockAction {
  id: string
  label: string
  inline: PageRegion | undefined
  compact: boolean
}

function maskPosition({ bbox }: PageRegion, page: PageDimensions): CSSProperties {
  return {
    left: (100 * bbox.x) / page.width + '%',
    top: (100 * bbox.y) / page.height + '%',
    width: (100 * bbox.width) / page.width + '%',
    height: (100 * bbox.height) / page.height + '%',
  }
}

export function DocumentViewer({ pages, mode, renderPage, onRevealedCount }: DocumentViewerProps) {
  const [revealed, setRevealed] = useState(new Set<string>())
  const [previousKind, setPreviousKind] = useState(mode.kind)
  const [width, setWidth] = useState(0)
  const viewer = useRef<HTMLElement>(null)
  const pendingFocus = useRef<string | null>(null)
  if (previousKind !== mode.kind) {
    setPreviousKind(mode.kind)
    if (revealed.size > 0) setRevealed(new Set())
  }
  const progressive = useProgressiveReveal(pages, mode.kind === 'progressive')

  useEffect(() => {
    const element = viewer.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const id = pendingFocus.current
    if (id === null) return
    pendingFocus.current = null
    const buttons = viewer.current?.querySelectorAll<HTMLButtonElement>('[data-block-action]')
    Array.from(buttons ?? [])
      .find((button) => button.dataset.blockAction === id)
      ?.focus({
        preventScroll: true,
      })
  }, [revealed])

  useEffect(() => onRevealedCount?.(revealed.size), [onRevealedCount, revealed])

  const widestPage = pages.reduce((maximum, page) => Math.max(maximum, page.width), 0)
  const scale = widestPage ? width / widestPage : 0
  const pageOrder = new Map(pages.map((page, index) => [page.pageIndex, index]))
  const masksByPage = new Map<
    number,
    { region: PageRegion; action?: BlockAction; grouped: boolean; marker: boolean }[]
  >()
  const actionsByPage = new Map<number, BlockAction[]>()

  if (mode.kind === 'automatic') {
    for (const [index, block] of mode.blocks.entries()) {
      const firstPage = block.regions.reduce(
        (first, region) => Math.min(first, pageOrder.get(region.pageIndex) ?? pages.length),
        pages.length,
      )
      if (firstPage === pages.length) continue

      const grouped = block.regions.length > 1
      // A region in a group of options must never receive a special affordance.
      const candidate = grouped ? undefined : block.regions[0]
      const inline =
        candidate && candidate.bbox.width * scale >= 48 && candidate.bbox.height * scale >= 44
          ? candidate
          : undefined
      const full = inline && inline.bbox.width * scale >= 172
      const action = {
        id: block.id,
        label: block.questionLabel ?? 'Bloc ' + (index + 1),
        inline,
        compact: !full,
      }

      if (!inline || revealed.has(block.id)) {
        const list = actionsByPage.get(firstPage) ?? []
        list.push(action)
        actionsByPage.set(firstPage, list)
      }
      if (revealed.has(block.id)) continue
      for (const region of block.regions) {
        const order = pageOrder.get(region.pageIndex)
        if (order === undefined) continue
        const masks = masksByPage.get(order) ?? []
        masks.push({
          region,
          action: region === inline ? action : undefined,
          grouped,
          marker: grouped && region.bbox.width <= 48 && region.bbox.height <= 48,
        })
        masksByPage.set(order, masks)
      }
    }
  }

  function toggleBlock(id: string) {
    pendingFocus.current = id
    setRevealed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section
      ref={viewer}
      className="pdf-viewer"
      aria-label="Document PDF"
      {...progressive.pointerEvents}
    >
      {pages.map((page, index) => {
        const visible = progressive.visibleFraction(index)
        const actions = actionsByPage.get(index)
        return (
          <section
            key={page.pageIndex}
            aria-label={'Page ' + (page.pageIndex + 1)}
            className="pdf-viewer-sheet"
            data-reader-page={page.pageIndex}
            style={{ width: (100 * page.width) / widestPage + '%' }}
          >
            <div
              className="pdf-viewer-page"
              data-page-position={index}
              data-fully-covered={
                mode.kind === 'covered' || (mode.kind === 'progressive' && visible === 0)
                  ? true
                  : undefined
              }
              style={{ aspectRatio: page.width + ' / ' + page.height }}
            >
              {renderPage(page)}
              {mode.kind === 'covered' && (
                <div
                  className="pdf-viewer-mask page-cover"
                  data-testid="page-cover"
                  aria-hidden="true"
                >
                  {index === 0 && (
                    <span>
                      <Icon name="lock" size={20} /> Document couvert
                    </span>
                  )}
                </div>
              )}
              {mode.kind === 'progressive' && visible < 1 && (
                <div
                  className="pdf-viewer-mask"
                  data-testid="progressive-mask"
                  aria-hidden="true"
                  style={{ top: 100 * visible + '%' }}
                />
              )}
              {masksByPage.get(index)?.map(({ region, action, grouped, marker }, maskIndex) => (
                <div
                  key={maskIndex}
                  className="pdf-viewer-mask pdf-viewer-region"
                  data-testid="correction-mask"
                  data-grouped-mask={grouped || undefined}
                  data-neutral-marker={marker || undefined}
                  aria-hidden={action ? undefined : true}
                  style={maskPosition(region, page)}
                >
                  {action && (
                    <button
                      type="button"
                      className="mask-action"
                      data-block-action={action.id}
                      aria-label={'Révéler la correction — ' + action.label}
                      title={'Révéler la correction — ' + action.label}
                      onClick={() => toggleBlock(action.id)}
                    >
                      <Icon name="eye" size={16} />
                      {!action.compact && <span>Révéler la correction</span>}
                    </button>
                  )}
                </div>
              ))}
              {mode.kind === 'progressive' && progressive.activePage === index && (
                <div
                  className="pdf-viewer-grip"
                  style={{ top: 100 * visible + '%' }}
                  {...progressive.sliderProps}
                >
                  <span aria-hidden="true">↕</span>
                </div>
              )}
            </div>
            {actions && (
              <div className="pdf-viewer-actions">
                {actions.map(({ id, label }) => {
                  const isRevealed = revealed.has(id)
                  const action = isRevealed ? 'Remasquer le corrigé' : 'Afficher le corrigé'
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-label={action + ' — ' + label}
                      data-block-action={id}
                      data-revealed={isRevealed || undefined}
                      onClick={() => toggleBlock(id)}
                    >
                      <Icon name={isRevealed ? 'eye-off' : 'eye'} size={16} />
                      <span className="pdf-viewer-block-label">{label}</span>
                      <span className="pdf-viewer-block-action">{action}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </section>
  )
}
