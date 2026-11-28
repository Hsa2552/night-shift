import { useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, Ref } from 'react'
import { Icon } from '../components/Icon'
import type { CorrectionBlock, PageDimensions, PageRegion } from '../shared/types'
import { CorrectionActions, type BlockAction } from './CorrectionActions'
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
  zoom?: number
  workspace?: boolean
  ref?: Ref<DocumentViewerHandle>
}

type CorrectionDirection = 'previous' | 'next' | 'unrevealed'

export interface DocumentViewerHandle {
  revealAll(): void
  remaskAll(): void
  navigateCorrection(direction: CorrectionDirection): void
}

interface InteractiveRegion {
  region: PageRegion
  id: string
  label: string
  key: string
  first: boolean
  grouped: boolean
  marker: boolean
}

function maskPosition({ bbox }: PageRegion, page: PageDimensions): CSSProperties {
  return {
    left: (100 * bbox.x) / page.width + '%',
    top: (100 * bbox.y) / page.height + '%',
    width: (100 * bbox.width) / page.width + '%',
    height: (100 * bbox.height) / page.height + '%',
  }
}

const smallRegion = ({ bbox }: PageRegion) => bbox.width <= 48 && bbox.height <= 48

function pageControls(mode: ViewerMode, pages: readonly PageDimensions[]) {
  const regionsByPage = new Map<number, InteractiveRegion[]>()
  const actionsByPage = new Map<number, BlockAction[]>()
  if (mode.kind !== 'automatic') return { regionsByPage, actionsByPage }

  const pageOrder = new Map(pages.map((page, index) => [page.pageIndex, index]))
  for (const [index, block] of mode.blocks.entries()) {
    const ordered = block.regions
      .map((region, regionIndex) => ({
        region,
        regionIndex,
        order: pageOrder.get(region.pageIndex),
      }))
      .filter((entry): entry is typeof entry & { order: number } => entry.order !== undefined)
      .sort((a, b) => a.order - b.order || a.region.bbox.y - b.region.bbox.y)
    const first = ordered[0]
    if (!first) continue

    const label = block.questionLabel ?? 'Bloc ' + (index + 1)
    const grouped = block.regions.length > 1
    const firstPage = pages[first.order]
    const group = ordered.filter(({ order }) => order === first.order)
    const top = first.region.bbox.y
    const bottom =
      group.length > 1 && group.every(({ region }) => smallRegion(region))
        ? Math.max(...group.map(({ region: { bbox } }) => bbox.y + bbox.height))
        : top + first.region.bbox.height
    const actions = actionsByPage.get(firstPage.pageIndex) ?? []
    actions.push({ id: block.id, label, anchor: (top + bottom) / (2 * firstPage.height) })
    actionsByPage.set(firstPage.pageIndex, actions)

    // Keep paint order and exact C1 rectangles. Controls sort independently of paint order.
    for (const [regionIndex, region] of block.regions.entries()) {
      if (!pageOrder.has(region.pageIndex)) continue
      const regions = regionsByPage.get(region.pageIndex) ?? []
      regions.push({
        region,
        id: block.id,
        label,
        key: block.id + ':' + regionIndex,
        first: regionIndex === first.regionIndex,
        grouped,
        marker: grouped && smallRegion(region),
      })
      regionsByPage.set(region.pageIndex, regions)
    }
  }

  for (const actions of actionsByPage.values()) actions.sort((a, b) => a.anchor - b.anchor)
  return { regionsByPage, actionsByPage }
}

export function DocumentViewer({
  pages,
  mode,
  renderPage,
  onRevealedCount,
  workspace = false,
  zoom = 100,
  ref,
}: DocumentViewerProps) {
  const [revealed, setRevealed] = useState(new Set<string>())
  const [previousKind, setPreviousKind] = useState(mode.kind)
  const [hovered, setHovered] = useState<string>()
  const [focused, setFocused] = useState<string>()
  const root = useRef<HTMLElement>(null)
  const lastCorrection = useRef<string>(undefined)
  const pointer = useRef<{ x: number; y: number; moved: boolean }>(undefined)
  if (previousKind !== mode.kind) {
    setPreviousKind(mode.kind)
    if (revealed.size > 0) setRevealed(new Set())
    setHovered(undefined)
    setFocused(undefined)
  }
  const highlighted = hovered ?? focused
  const progressive = useProgressiveReveal(pages, mode.kind === 'progressive')

  useLayoutEffect(() => onRevealedCount?.(revealed.size), [onRevealedCount, revealed])

  const widestPage = pages.reduce((maximum, page) => Math.max(maximum, page.width), 0)
  const { regionsByPage, actionsByPage } = useMemo(() => pageControls(mode, pages), [mode, pages])

  useLayoutEffect(() => {
    lastCorrection.current = undefined
  }, [mode.kind])

  function navigateCorrection(direction: CorrectionDirection) {
    const primary = root.current?.querySelectorAll<HTMLButtonElement>('[data-primary-region]')
    if (!primary?.length) return
    const byId = new Map(Array.from(primary, (target) => [target.dataset.blockRegion, target]))
    const ordered = pages.flatMap((page) =>
      (actionsByPage.get(page.pageIndex) ?? []).flatMap(({ id }) => {
        const target = byId.get(id)
        return target ? [{ id, target }] : []
      }),
    )
    const anchor = window.innerHeight * 0.35
    const cursor = ordered.findIndex(({ id, target }) => {
      if (id !== lastCorrection.current) return false
      const rect = target.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < window.innerHeight
    })
    const before =
      cursor < 0
        ? ordered.findLastIndex(({ target }) => target.getBoundingClientRect().top < anchor)
        : cursor
    let entry
    if (direction === 'previous') {
      entry = ordered[cursor < 0 ? before : cursor - 1]
    } else if (direction === 'next') {
      entry = ordered[Math.min(before + 1, ordered.length - 1)]
    } else {
      const next = ordered.slice(before + 1).concat(ordered.slice(0, before + 1))
      entry = next.find(({ id }) => !revealed.has(id))
    }
    if (!entry) return
    lastCorrection.current = entry.id
    entry.target.scrollIntoView?.({ block: 'center', inline: 'nearest' })
    entry.target.focus({ preventScroll: true })
  }

  useImperativeHandle(ref, () => ({
    revealAll: () => {
      if (mode.kind === 'automatic') setRevealed(new Set(mode.blocks.map(({ id }) => id)))
    },
    remaskAll: () => setRevealed(new Set()),
    navigateCorrection,
  }))

  function toggleBlock(id: string) {
    lastCorrection.current = id
    setRevealed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section
      ref={root}
      className="pdf-viewer"
      aria-label="Document PDF"
      data-workspace-pages={workspace || undefined}
      {...progressive.pointerEvents}
      onPointerMove={(event) => {
        progressive.pointerEvents.onPointerMove(event)
        const start = pointer.current
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
          start.moved = true
        }
      }}
      onPointerCancel={(event) => {
        progressive.pointerEvents.onPointerCancel(event)
        if (pointer.current) pointer.current.moved = true
      }}
    >
      {pages.map((page, index) => {
        const visible = progressive.visibleFraction(index)
        const actions = actionsByPage.get(page.pageIndex)
        const width = (zoom * page.width) / widestPage
        const regions = regionsByPage.get(page.pageIndex)
        return (
          <section
            key={page.pageIndex}
            aria-label={'Page ' + (page.pageIndex + 1)}
            className="pdf-viewer-sheet"
            data-reader-page={page.pageIndex}
            data-has-actions={!!actions || undefined}
            style={workspace ? undefined : { width: width + '%' }}
          >
            <div
              className="pdf-viewer-page-scroll"
              tabIndex={workspace && width > 100 ? 0 : undefined}
              aria-label={workspace && width > 100 ? 'Défilement horizontal de la page' : undefined}
            >
              <div
                className="pdf-viewer-page"
                data-page-position={index}
                data-fully-covered={
                  mode.kind === 'covered' || (mode.kind === 'progressive' && visible === 0)
                    ? true
                    : undefined
                }
                style={{
                  aspectRatio: page.width + ' / ' + page.height,
                  width: workspace ? width + '%' : undefined,
                }}
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
                {regions?.map(({ region, id, label, key, first, grouped, marker }) => {
                  const isRevealed = revealed.has(id)
                  return (
                    <button
                      key={key}
                      type="button"
                      className="pdf-viewer-region"
                      data-testid={isRevealed ? undefined : 'correction-mask'}
                      data-block-region={id}
                      data-primary-region={first || undefined}
                      data-grouped-mask={(!isRevealed && grouped) || undefined}
                      data-neutral-marker={(!isRevealed && marker) || undefined}
                      data-highlighted={highlighted === id || undefined}
                      aria-label={
                        (isRevealed ? 'Recouvrir dans le PDF' : 'Révéler dans le PDF') +
                        ' — ' +
                        label
                      }
                      aria-pressed={isRevealed}
                      aria-hidden={first ? undefined : true}
                      tabIndex={first ? undefined : -1}
                      style={maskPosition(region, page)}
                      onPointerDown={(event) => {
                        pointer.current = { x: event.clientX, y: event.clientY, moved: false }
                      }}
                      onMouseDown={(event) => {
                        if (!first) event.preventDefault()
                      }}
                      onPointerEnter={(event) => {
                        if (event.pointerType !== 'touch') setHovered(id)
                      }}
                      onPointerLeave={() => setHovered(undefined)}
                      onFocus={() => setFocused(id)}
                      onBlur={() => setFocused(undefined)}
                      onClick={(event) => {
                        const dragged = pointer.current?.moved
                        pointer.current = undefined
                        if (
                          event.detail !== 0 &&
                          (dragged || window.getSelection()?.isCollapsed === false)
                        )
                          return
                        toggleBlock(id)
                      }}
                    >
                      {!isRevealed && !grouped && (
                        <span className="pdf-viewer-region-hint" aria-hidden="true">
                          <Icon name="eye" size={16} />
                          <span>Révéler la correction</span>
                        </span>
                      )}
                    </button>
                  )
                })}
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
            </div>
            {actions && (
              <CorrectionActions
                actions={actions}
                revealed={revealed}
                highlighted={highlighted}
                onToggle={toggleBlock}
                onHover={setHovered}
                onFocus={setFocused}
              />
            )}
          </section>
        )
      })}
    </section>
  )
}
