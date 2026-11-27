import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
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
}

function maskPosition({ bbox }: PageRegion, page: PageDimensions): CSSProperties {
  return {
    left: `${(100 * bbox.x) / page.width}%`,
    top: `${(100 * bbox.y) / page.height}%`,
    width: `${(100 * bbox.width) / page.width}%`,
    height: `${(100 * bbox.height) / page.height}%`,
  }
}

export function DocumentViewer({ pages, mode, renderPage }: DocumentViewerProps) {
  const [revealed, setRevealed] = useState(new Set<string>())
  const [previousKind, setPreviousKind] = useState(mode.kind)
  if (previousKind !== mode.kind) {
    setPreviousKind(mode.kind)
    if (revealed.size > 0) setRevealed(new Set())
  }
  const progressive = useProgressiveReveal(pages, mode.kind === 'progressive')
  const widestPage = pages.reduce((maximum, page) => Math.max(maximum, page.width), 0)
  const pageOrder = new Map(pages.map((page, index) => [page.pageIndex, index]))
  const masksByPage = new Map<number, PageRegion[]>()
  const actionsByPage = new Map<number, { block: CorrectionBlock; label: string }[]>()

  if (mode.kind === 'automatic' && mode.blocks.length > 0) {
    for (const [index, block] of mode.blocks.entries()) {
      let firstPage = pages.length
      for (const region of block.regions) {
        const order = pageOrder.get(region.pageIndex)
        if (order === undefined) continue
        firstPage = Math.min(firstPage, order)
        if (revealed.has(block.id)) continue
        const masks = masksByPage.get(order) ?? []
        masks.push(region)
        masksByPage.set(order, masks)
      }
      if (firstPage === pages.length) continue
      const actions = actionsByPage.get(firstPage) ?? []
      actions.push({ block, label: block.questionLabel ?? `Bloc ${index + 1}` })
      actionsByPage.set(firstPage, actions)
    }
  }

  function toggleBlock(id: string) {
    setRevealed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="pdf-viewer" aria-label="Document PDF" {...progressive.pointerEvents}>
      {pages.map((page, index) => {
        const visible = progressive.visibleFraction(index)
        const actions = actionsByPage.get(index)
        return (
          <section
            key={page.pageIndex}
            aria-label={`Page ${page.pageIndex + 1}`}
            className="pdf-viewer-sheet"
            style={{ width: `${(100 * page.width) / widestPage}%` }}
          >
            {actions && (
              <div className="pdf-viewer-actions">
                {actions.map(({ block, label }) => {
                  const isRevealed = revealed.has(block.id)
                  const action = isRevealed ? 'Remasquer le corrigé' : 'Afficher le corrigé'
                  return (
                    <button
                      key={block.id}
                      type="button"
                      aria-label={`${action} — ${label}`}
                      data-revealed={isRevealed ? true : undefined}
                      onClick={() => toggleBlock(block.id)}
                    >
                      <span className="pdf-viewer-block-label">{label}</span>
                      <span className="pdf-viewer-block-action">{action}</span>
                    </button>
                  )
                })}
              </div>
            )}
            <div
              className="pdf-viewer-page"
              data-page-position={index}
              data-fully-covered={
                mode.kind === 'covered' || (mode.kind === 'progressive' && visible === 0)
                  ? true
                  : undefined
              }
              style={{ aspectRatio: `${page.width} / ${page.height}` }}
            >
              {renderPage(page)}
              {mode.kind === 'covered' && (
                <div className="pdf-viewer-mask" data-testid="page-cover" aria-hidden="true" />
              )}
              {mode.kind === 'progressive' && visible < 1 && (
                <div
                  className="pdf-viewer-mask"
                  data-testid="progressive-mask"
                  aria-hidden="true"
                  style={{ top: `${100 * visible}%` }}
                />
              )}
              {masksByPage.get(index)?.map((region, maskIndex) => (
                <div
                  key={maskIndex}
                  className="pdf-viewer-mask pdf-viewer-region"
                  data-testid="correction-mask"
                  aria-hidden="true"
                  style={maskPosition(region, page)}
                />
              ))}
              {mode.kind === 'progressive' && progressive.activePage === index && (
                <div
                  className="pdf-viewer-grip"
                  style={{ top: `${100 * visible}%` }}
                  {...progressive.sliderProps}
                >
                  <span aria-hidden="true">↕</span>
                </div>
              )}
            </div>
          </section>
        )
      })}
    </section>
  )
}
