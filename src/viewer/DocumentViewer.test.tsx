import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DocumentViewer, type DocumentViewerHandle } from './DocumentViewer'
import '../index.css'

// Pages et rectangles synthétiques pour tester l'interface sans PDF.js.
const pages = [
  { pageIndex: 0, width: 400, height: 600 },
  { pageIndex: 1, width: 300, height: 450 },
]
const renderPage = () => <canvas aria-hidden="true" />
const blocks = [
  {
    id: 'q1',
    questionLabel: 'Question 1',
    regions: [
      { pageIndex: 0, bbox: { x: 80, y: 150, width: 200, height: 60 } },
      { pageIndex: 0, bbox: { x: 80, y: 210, width: 150, height: 45 } },
      { pageIndex: 1, bbox: { x: 60, y: 30, width: 180, height: 70 } },
    ],
  },
  {
    id: 'q2',
    questionLabel: 'Question 2',
    regions: [{ pageIndex: 1, bbox: { x: 60, y: 225, width: 120, height: 45 } }],
  },
]

function mockPageBounds(page: HTMLElement, top: number, height: number) {
  const canvas = page.querySelector('canvas')!
  vi.spyOn(canvas.parentElement!, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, top, 200, height),
  )
}

async function nextFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

describe('lecteur', () => {
  it('masque toutes les cases d’un QCM de la même façon et les restaure ensemble', () => {
    const options = {
      id: 'qcm',
      questionLabel: 'Question à choix multiples',
      regions: [80, 116, 152, 188].map((y) => ({
        pageIndex: 0,
        bbox: { x: 24, y, width: 15, height: 15 },
      })),
    }
    render(
      <DocumentViewer
        pages={pages}
        mode={{ kind: 'automatic', blocks: [options] }}
        renderPage={renderPage}
      />,
    )
    const masks = screen.getAllByTestId('correction-mask')
    expect(masks).toHaveLength(4)
    for (const box of masks) {
      expect(box.hasAttribute('data-neutral-marker')).toBe(true)
      expect(box.hasAttribute('data-grouped-mask')).toBe(true)
      expect(within(box).queryByRole('button')).toBeNull()
    }
    fireEvent.click(
      screen.getByRole('button', { name: 'Afficher le corrigé — Question à choix multiples' }),
    )
    expect(screen.queryAllByTestId('correction-mask')).toHaveLength(0)
    fireEvent.click(
      screen.getByRole('button', { name: 'Remasquer le corrigé — Question à choix multiples' }),
    )
    expect(screen.getAllByTestId('correction-mask')).toHaveLength(4)
  })
  it('couvre chaque page avant la sélection du mode de lecture', () => {
    render(<DocumentViewer pages={pages} mode={{ kind: 'covered' }} renderPage={renderPage} />)
    expect(screen.getAllByTestId('page-cover')).toHaveLength(2)
    expect(document.querySelectorAll('[data-fully-covered]')).toHaveLength(2)
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('révèle puis remasque tous les rectangles du même bloc, même sur une autre page', () => {
    render(
      <DocumentViewer pages={pages} mode={{ kind: 'automatic', blocks }} renderPage={renderPage} />,
    )
    const firstPage = within(screen.getByRole('region', { name: 'Page 1' }))
    const secondPage = within(screen.getByRole('region', { name: 'Page 2' }))
    expect(firstPage.getAllByTestId('correction-mask')).toHaveLength(2)
    expect(secondPage.getAllByTestId('correction-mask')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Afficher le corrigé — Question 1' }))
    expect(firstPage.queryByTestId('correction-mask')).toBeNull()
    expect(secondPage.getByTestId('correction-mask').style.top).toBe('50%')
    fireEvent.click(screen.getByRole('button', { name: 'Remasquer le corrigé — Question 1' }))
    expect(screen.getAllByTestId('correction-mask')).toHaveLength(4)
  })

  it('synchronise la zone cliquée et la commande sans déplacer ni démonter les cibles', () => {
    const { rerender } = render(
      <DocumentViewer
        pages={pages}
        mode={{ kind: 'automatic', blocks }}
        workspace
        renderPage={renderPage}
      />,
    )
    const q1 = screen.getByRole('button', { name: 'Afficher le corrigé — Question 1' })
    const masks = screen.getAllByTestId('correction-mask')
    const target = masks[1]
    const otherPage = masks[2]
    const before = target.getAttribute('style')
    fireEvent.click(target)
    expect(q1.getAttribute('data-revealed')).toBe('true')
    expect(screen.getAllByTestId('correction-mask')).toHaveLength(1)
    expect(target.isConnected).toBe(true)
    expect(otherPage.isConnected).toBe(true)
    expect(target.getAttribute('style')).toBe(before)
    rerender(
      <DocumentViewer
        pages={pages}
        mode={{ kind: 'automatic', blocks }}
        workspace
        zoom={150}
        renderPage={renderPage}
      />,
    )
    fireEvent.click(otherPage)
    expect(screen.getAllByTestId('correction-mask')).toHaveLength(4)
    expect(screen.getAllByTestId('correction-mask')[1]).toBe(target)
    expect(screen.getByRole('button', { name: 'Afficher le corrigé — Question 1' })).toBe(q1)
    act(() => q1.focus())
    expect(target.getAttribute('data-highlighted')).toBe('true')
    expect(otherPage.getAttribute('data-highlighted')).toBe('true')
  })

  it('affiche toutes les cases du même bloc après un clic sur une petite région', () => {
    const qcm = {
      id: 'qcm',
      regions: [30, 54, 78].map((y) => ({
        pageIndex: 0,
        bbox: { x: 20, y, width: 14, height: 14 },
      })),
    }
    render(
      <DocumentViewer
        pages={pages}
        mode={{ kind: 'automatic', blocks: [qcm] }}
        renderPage={renderPage}
      />,
    )
    const target = screen.getAllByTestId('correction-mask')[2]
    fireEvent.click(target)
    expect(screen.queryAllByTestId('correction-mask')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Remasquer le corrigé — Bloc 1' })).toBeTruthy()
    fireEvent.click(target)
    expect(screen.getAllByTestId('correction-mask')).toHaveLength(3)
  })

  it('laisse un glissement sur un masque sans révélation et réinitialise au changement de mode', () => {
    const { rerender } = render(
      <DocumentViewer pages={pages} mode={{ kind: 'automatic', blocks }} renderPage={renderPage} />,
    )
    const target = screen.getAllByTestId('correction-mask')[0]
    fireEvent.pointerDown(target, { clientX: 90, clientY: 155 })
    fireEvent.pointerMove(target, { clientX: 90, clientY: 175 })
    fireEvent.click(target, { detail: 1 })
    expect(screen.getAllByTestId('correction-mask')).toHaveLength(4)
    fireEvent.click(target)
    expect(screen.getAllByTestId('correction-mask')).toHaveLength(1)
    rerender(
      <DocumentViewer pages={pages} mode={{ kind: 'progressive' }} renderPage={renderPage} />,
    )
    expect(screen.getAllByTestId('progressive-mask')).toHaveLength(2)
    expect(document.querySelector('[data-block-region]')).toBeNull()
    rerender(
      <DocumentViewer pages={pages} mode={{ kind: 'automatic', blocks }} renderPage={renderPage} />,
    )
    expect(screen.getAllByTestId('correction-mask')).toHaveLength(4)
  })

  it('suit l’ordre des corrections et permet d’ignorer les blocs révélés', () => {
    const ref = createRef<DocumentViewerHandle>()
    render(
      <DocumentViewer
        ref={ref}
        pages={pages}
        mode={{ kind: 'automatic', blocks }}
        renderPage={renderPage}
      />,
    )
    const first = screen.getByRole('button', { name: 'Révéler dans le PDF — Question 1' })
    const second = screen.getByRole('button', { name: 'Révéler dans le PDF — Question 2' })
    vi.spyOn(first, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 400, 100, 40))
    vi.spyOn(second, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 600, 100, 40))
    act(() => ref.current?.navigateCorrection('next'))
    expect(document.activeElement).toBe(first)
    expect(screen.getAllByTestId('correction-mask')).toHaveLength(4)
    fireEvent.click(first)
    act(() => ref.current?.navigateCorrection('unrevealed'))
    expect(document.activeElement).toBe(second)
    expect(screen.getAllByTestId('correction-mask')).toHaveLength(1)
    act(() => ref.current?.navigateCorrection('previous'))
    expect(document.activeElement).toBe(first)
  })

  it('exprime les régions en pourcentages des dimensions canoniques de chaque page', () => {
    render(
      <DocumentViewer pages={pages} mode={{ kind: 'automatic', blocks }} renderPage={renderPage} />,
    )
    const [firstMask, , , lastMask] = screen.getAllByTestId('correction-mask')
    expect(firstMask.style.left).toBe('20%')
    expect(firstMask.style.top).toBe('25%')
    expect(firstMask.style.width).toBe('50%')
    expect(firstMask.style.height).toBe('10%')
    expect(lastMask.style.width).toBe('40%')
  })

  it('garde la même commande accessible après un changement de largeur et une révélation', () => {
    let resize: ((width: number) => void) | undefined
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = (width) =>
            callback(
              [{ contentRect: new DOMRect(0, 0, width, 400) }] as ResizeObserverEntry[],
              this as ResizeObserver,
            )
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    try {
      render(
        <DocumentViewer
          pages={pages}
          mode={{ kind: 'automatic', blocks }}
          renderPage={renderPage}
        />,
      )
      const action = screen.getByRole('button', { name: 'Afficher le corrigé — Question 2' })
      action.focus()
      act(() => resize?.(1000))
      expect(screen.getByRole('button', { name: 'Afficher le corrigé — Question 2' })).toBe(action)
      fireEvent.click(action)
      expect(screen.getByRole('button', { name: 'Remasquer le corrigé — Question 2' })).toBe(action)
      expect(document.activeElement).toBe(action)
      expect(screen.getAllByTestId('correction-mask')).toHaveLength(3)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('déplace la frontière entre des pages de tailles différentes et remasque en remontant', async () => {
    render(<DocumentViewer pages={pages} mode={{ kind: 'progressive' }} renderPage={renderPage} />)
    const first = screen.getByRole('region', { name: 'Page 1' })
    const second = screen.getByRole('region', { name: 'Page 2' })
    mockPageBounds(first, 100, 300)
    mockPageBounds(second, 425, 225)
    const slider = screen.getByRole('slider')
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 78, 200, 44))
    expect(screen.getAllByTestId('progressive-mask').map((mask) => mask.style.top)).toEqual([
      '0%',
      '0%',
    ])

    const viewer = screen.getByRole('region', { name: 'Document PDF' })
    fireEvent.pointerDown(slider, { pointerId: 1, pointerType: 'touch', button: 0, clientY: 100 })
    fireEvent.pointerMove(viewer, { pointerId: 1, pointerType: 'touch', clientY: 250 })
    await nextFrame()
    expect(within(first).getByTestId('progressive-mask').style.top).toBe('50%')
    expect(within(second).getByTestId('progressive-mask').style.top).toBe('0%')
    fireEvent.pointerMove(viewer, { pointerId: 1, pointerType: 'touch', clientY: 500 })
    await nextFrame()
    expect(within(first).queryByTestId('progressive-mask')).toBeNull()
    expect(Number.parseFloat(within(second).getByTestId('progressive-mask').style.top)).toBeCloseTo(
      100 / 3,
    )
    fireEvent.pointerMove(viewer, { pointerId: 1, pointerType: 'touch', clientY: 100 })
    fireEvent.pointerUp(viewer, { pointerId: 1, pointerType: 'touch', clientY: 100 })
    expect(screen.getAllByTestId('progressive-mask').map((mask) => mask.style.top)).toEqual([
      '0%',
      '0%',
    ])
  })

  it('garde le document couvert après un appui près du bord de l’écran sans glissement', async () => {
    render(<DocumentViewer pages={pages} mode={{ kind: 'progressive' }} renderPage={renderPage} />)
    const viewer = screen.getByRole('region', { name: 'Document PDF' })
    const slider = screen.getByRole('slider')
    const y = window.innerHeight - 10
    mockPageBounds(screen.getByRole('region', { name: 'Page 1' }), y, 300)
    mockPageBounds(screen.getByRole('region', { name: 'Page 2' }), y + 310, 225)
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, y - 22, 200, 44))
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined)
    try {
      fireEvent.pointerDown(slider, { pointerId: 1, pointerType: 'touch', button: 0, clientY: y })
      fireEvent.pointerMove(viewer, { pointerId: 1, pointerType: 'touch', clientY: y + 1 })
      await nextFrame()
      fireEvent.pointerUp(viewer, { pointerId: 1, pointerType: 'touch', clientY: y + 1 })
      expect(scroll).not.toHaveBeenCalled()
      expect(slider.getAttribute('aria-valuenow')).toBe('0')
    } finally {
      scroll.mockRestore()
    }
  })

  it('met à jour la position et le focus du trait au clavier', () => {
    render(<DocumentViewer pages={pages} mode={{ kind: 'progressive' }} renderPage={renderPage} />)
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowDown' })
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('2')
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' })
    expect(screen.queryByTestId('progressive-mask')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('slider'))
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'Home' })
    expect(screen.getAllByTestId('progressive-mask')).toHaveLength(2)
    expect(document.activeElement).toBe(screen.getByRole('slider'))
  })
})
