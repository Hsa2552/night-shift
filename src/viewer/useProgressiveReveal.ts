import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

function clamp(value: number, max: number) {
  return Math.min(Math.max(value, 0), max)
}

interface Drag {
  pointerId: number
  pages: NodeListOf<HTMLElement>
  clientY: number
  grabOffset: number
  frame: number
}

export function useProgressiveReveal(pages: readonly { height: number }[], enabled: boolean) {
  const [position, setPosition] = useState(0)
  const [wasEnabled, setWasEnabled] = useState(enabled)
  if (enabled !== wasEnabled) {
    setWasEnabled(enabled)
    if (position !== 0) setPosition(0)
  }
  const drag = useRef<Drag | null>(null)
  const slider = useRef<HTMLDivElement>(null)
  const focusSlider = useRef(false)
  const { pageStarts, totalHeight } = useMemo(() => {
    let totalHeight = 0
    const pageStarts = pages.map(({ height }) => {
      const start = totalHeight
      totalHeight += height
      return start
    })
    return { pageStarts, totalHeight }
  }, [pages])
  const activePage = Math.max(
    0,
    pageStarts.findLastIndex((start) => start <= position),
  )

  useLayoutEffect(() => {
    return () => {
      if (drag.current) cancelAnimationFrame(drag.current.frame)
      drag.current = null
    }
  }, [enabled])

  useLayoutEffect(() => {
    if (focusSlider.current) {
      focusSlider.current = false
      slider.current?.focus({ preventScroll: true })
      slider.current?.scrollIntoView?.({ block: 'nearest' })
    }
  }, [position])

  function visibleFraction(index: number) {
    return clamp((position - pageStarts[index]) / pages[index].height, 1)
  }

  function updateFromPointer(current: Drag) {
    const y = current.clientY - current.grabOffset
    for (const [index, page] of current.pages.entries()) {
      const rect = page.getBoundingClientRect()
      if (rect.height > 0 && y <= rect.bottom) {
        const fraction = clamp((y - rect.top) / rect.height, 1)
        setPosition(pageStarts[index] + fraction * pages[index].height)
        return
      }
    }
    setPosition(totalHeight)
  }

  function scrollDuringDrag() {
    const current = drag.current
    if (!current) return
    const margin = 48
    const above = Math.max(0, margin - current.clientY)
    const below = Math.max(0, current.clientY - window.innerHeight + margin)
    if (above || below) {
      const oldScroll = window.scrollY
      window.scrollBy(0, clamp(below, margin) / 3 - clamp(above, margin) / 3)
      if (oldScroll !== window.scrollY) updateFromPointer(current)
    }
    current.frame = requestAnimationFrame(scrollDuringDrag)
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || drag.current) return
    const viewer = event.currentTarget.closest('.pdf-viewer')
    if (!viewer) return
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.focus({ preventScroll: true })
    viewer.setPointerCapture?.(event.pointerId)
    drag.current = {
      pointerId: event.pointerId,
      pages: viewer.querySelectorAll<HTMLElement>('[data-page-position]'),
      clientY: event.clientY,
      grabOffset: event.clientY - rect.top - rect.height / 2,
      frame: requestAnimationFrame(scrollDuringDrag),
    }
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const current = drag.current
    if (current?.pointerId !== event.pointerId) return
    current.clientY = event.clientY
    updateFromPointer(current)
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    cancelAnimationFrame(drag.current.frame)
    drag.current = null
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const step = pages[activePage].height / 30
    const targets: Record<string, number> = {
      ArrowUp: position - step,
      ArrowDown: position + step,
      PageUp: position - step * 10,
      PageDown: position + step * 10,
      Home: 0,
      End: totalHeight,
    }
    const target = targets[event.key]
    if (target === undefined) return
    event.preventDefault()
    const next = clamp(target, totalHeight)
    if (next === position) return
    focusSlider.current = true
    setPosition(next)
  }

  const documentPercent = totalHeight ? Math.round((position / totalHeight) * 100) : 0

  return {
    activePage,
    visibleFraction,
    pointerEvents: {
      onPointerMove: moveDrag,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
    },
    sliderProps: {
      ref: slider,
      role: 'slider',
      tabIndex: 0,
      'aria-label': 'Frontière de révélation',
      'aria-orientation': 'vertical' as const,
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': documentPercent,
      'aria-valuetext': `Page ${activePage + 1}, ${documentPercent} % du document visible`,
      onKeyDown: moveWithKeyboard,
      onPointerDown: startDrag,
    },
  }
}
