import { useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'

export interface BlockAction {
  id: string
  label: string
  anchor: number
}

interface CorrectionActionsProps {
  actions: readonly BlockAction[]
  revealed: ReadonlySet<string>
  highlighted?: string
  onToggle: (id: string) => void
  onHover: (id?: string) => void
  onFocus: (id?: string) => void
}

const gap = 6

function placeActions(actions: readonly BlockAction[], height: number, buttonHeight: number) {
  if (buttonHeight <= 0 || height < actions.length * (buttonHeight + gap) - gap) return null

  let next = 0
  return actions.map(({ anchor }, index) => {
    const latest = height - buttonHeight - (actions.length - index - 1) * (buttonHeight + gap)
    const top = Math.max(next, Math.min(latest, anchor * height - buttonHeight / 2))
    next = top + buttonHeight + gap
    return top
  })
}

export function CorrectionActions({
  actions,
  revealed,
  highlighted,
  onToggle,
  onHover,
  onFocus,
}: CorrectionActionsProps) {
  const rail = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({ height: 0, buttonHeight: 0 })

  useLayoutEffect(() => {
    const element = rail.current
    const button = element?.querySelector('button')
    if (!element || !button || typeof ResizeObserver === 'undefined') return

    function measure() {
      if (!element || !button) return
      const height = element.clientHeight
      const buttonHeight = button.offsetHeight
      setLayout((current) =>
        current.height === height && current.buttonHeight === buttonHeight
          ? current
          : { height, buttonHeight },
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    observer.observe(button)
    return () => observer.disconnect()
  }, [])

  const positions = placeActions(actions, layout.height, layout.buttonHeight)

  return (
    <div
      className="pdf-viewer-actions"
      ref={rail}
      role="group"
      aria-label="Corrections de la page"
      data-positioned={positions !== null || undefined}
    >
      <div className="pdf-viewer-action-list">
        {actions.map(({ id, label }, index) => {
          const isRevealed = revealed.has(id)
          const action = isRevealed ? 'Remasquer le corrigé' : 'Afficher le corrigé'
          return (
            <button
              key={id}
              type="button"
              aria-label={action + ' — ' + label}
              aria-pressed={isRevealed}
              title={label + ' — ' + action}
              data-block-action={id}
              data-revealed={isRevealed || undefined}
              data-highlighted={highlighted === id || undefined}
              style={positions ? { top: positions[index] } : undefined}
              onClick={() => onToggle(id)}
              onPointerEnter={(event) => {
                if (event.pointerType !== 'touch') onHover(id)
              }}
              onPointerLeave={() => onHover()}
              onFocus={() => onFocus(id)}
              onBlur={() => onFocus()}
            >
              <Icon name={isRevealed ? 'eye-off' : 'eye'} size={17} />
              <span className="pdf-viewer-action-copy">
                <span className="pdf-viewer-block-label">{label}</span>
                <span className="pdf-viewer-block-action">
                  {isRevealed ? 'Remasquer' : 'Afficher'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
