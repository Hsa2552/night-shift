import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

function clamp(value: number, max: number) {
  return Math.min(Math.max(value, 0), max)
}

interface Drag {
  pointerId: number
  pages: NodeListOf<HTMLElement>
  startY: number
  clientY: number
  grabOffset: number
  moved: boolean
  frame?: number
}

function findFirstPage(count: number, matches: (index: number) => boolean) {
  let start = 0
  let end = count
  while (start < end) {
    const middle = Math.floor((start + end) / 2)
    if (matches(middle)) end = middle
    else start = middle + 1
  }
  return start
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
    findFirstPage(pages.length, (index) => pageStarts[index] > position) - 1,
  )

  useLayoutEffect(() => {
    if (enabled) slider.current?.focus({ preventScroll: true })
    return () => {
      if (drag.current?.frame !== undefined) cancelAnimationFrame(drag.current.frame)
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
    const index = findFirstPage(
      current.pages.length,
      (pageIndex) => y <= current.pages[pageIndex].getBoundingClientRect().bottom,
    )
    const rect = current.pages[index]?.getBoundingClientRect()
    if (!rect) {
      setPosition(totalHeight)
    } else if (rect.height > 0) {
      const fraction = clamp((y - rect.top) / rect.height, 1)
      setPosition(pageStarts[index] + fraction * pages[index].height)
    }
  }

  function updateDragFrame() {
    const current = drag.current
    if (!current) return
    current.frame = undefined
    const margin = 48
    const viewportTop = window.visualViewport?.offsetTop ?? 0
    const viewportBottom = viewportTop + (window.visualViewport?.height ?? window.innerHeight)
    const above = clamp(viewportTop + margin - current.clientY, margin)
    const below = clamp(current.clientY - viewportBottom + margin, margin)
    const scrollStep = (below - above) / 3
    const oldScroll = window.scrollY
    if (scrollStep !== 0) window.scrollBy(0, scrollStep)
    updateFromPointer(current)
    if (oldScroll !== window.scrollY) {
      current.frame = requestAnimationFrame(updateDragFrame)
    }
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
      startY: event.clientY,
      clientY: event.clientY,
      grabOffset: event.clientY - rect.top - rect.height / 2,
      moved: false,
    }
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const current = drag.current
    if (current?.pointerId !== event.pointerId) return
    if (!current.moved && Math.abs(event.clientY - current.startY) < 3) return
    current.moved = true
    current.clientY = event.clientY
    current.frame ??= requestAnimationFrame(updateDragFrame)
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    const current = drag.current
    if (current?.pointerId !== event.pointerId) return
    if (current.frame !== undefined) cancelAnimationFrame(current.frame)
    drag.current = null
    if (event.type === 'pointerup' && current.moved) {
      current.clientY = event.clientY
      updateFromPointer(current)
    }
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
