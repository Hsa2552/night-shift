import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DocumentViewer } from './DocumentViewer'
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

describe('lecteur', () => {
  it('couvre chaque page avant la sélection du mode de lecture', () => {
    render(<DocumentViewer pages={pages} mode={{ kind: 'covered' }} renderPage={renderPage} />)
    expect(screen.getAllByTestId('page-cover')).toHaveLength(2)
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

  it('déplace la frontière entre des pages de tailles différentes et remasque en remontant', () => {
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
    expect(within(first).getByTestId('progressive-mask').style.top).toBe('50%')
    expect(within(second).getByTestId('progressive-mask').style.top).toBe('0%')
    fireEvent.pointerMove(viewer, { pointerId: 1, pointerType: 'touch', clientY: 500 })
    expect(within(first).queryByTestId('progressive-mask')).toBeNull()
    expect(Number.parseFloat(within(second).getByTestId('progressive-mask').style.top)).toBeCloseTo(
      100 / 3,
    )
    fireEvent.pointerMove(viewer, { pointerId: 1, pointerType: 'touch', clientY: 100 })
    expect(screen.getAllByTestId('progressive-mask').map((mask) => mask.style.top)).toEqual([
      '0%',
      '0%',
    ])
    fireEvent.pointerUp(viewer, { pointerId: 1, pointerType: 'touch' })
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
