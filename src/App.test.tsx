import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { detectCorrections } from './detection'
import { openPdf } from './pdf'
import type { PdfDocument } from './pdf'
import type { DetectionResult } from './shared/types'

vi.mock('./pdf', () => ({ openPdf: vi.fn() }))
vi.mock('./detection', () => ({ detectCorrections: vi.fn() }))
vi.mock('./viewer/PdfCanvas', () => ({ PdfCanvas: () => <canvas aria-hidden="true" /> }))

const loadPdf = vi.mocked(openPdf)
const detect = vi.mocked(detectCorrections)
const page = { pageIndex: 0, width: 400, height: 600 }
// Données synthétiques du contrat PDF/détection pour tester les transitions de l'interface.
const block = {
  id: 'q1',
  questionLabel: 'Question 1',
  regions: [{ pageIndex: 0, bbox: { x: 40, y: 100, width: 250, height: 60 } }],
}

function fakePdf() {
  return {
    pageCount: 1,
    getPageDimensions: vi.fn().mockResolvedValue(page),
    getPageData: vi.fn().mockResolvedValue({ ...page, textItems: [] }),
    renderPage: vi.fn().mockResolvedValue(undefined),
    getRaster: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  } satisfies PdfDocument
}

function selectFile(name: string, type = 'application/pdf') {
  const field = screen.getByLabelText(/Importer un PDF|Changer de PDF/)
  fireEvent.change(field, { target: { files: [new File(['synthétique'], name, { type })] } })
}

async function importDocument() {
  render(<App />)
  selectFile('annale-synthetique.pdf')
  await screen.findByRole('heading', { name: 'annale-synthetique.pdf' })
}

function startAnalysis() {
  fireEvent.click(screen.getByRole('button', { name: 'Masquer les corrigés' }))
}

beforeEach(() => {
  vi.resetAllMocks()
  loadPdf.mockResolvedValue(fakePdf())
})

describe('Unspoil', () => {
  it('ouvre le PDF couvert avec le mode progressif accessible avant toute extraction de texte', async () => {
    const pdf = fakePdf()
    loadPdf.mockResolvedValue(pdf)
    await importDocument()
    expect(pdf.getPageDimensions).toHaveBeenCalledWith(0)
    expect(pdf.getPageData).not.toHaveBeenCalled()
    expect(screen.getByTestId('page-cover')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Révélation progressive' }))
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('0')
    expect(screen.getByTestId('progressive-mask').style.top).toBe('0%')
    expect(detect).not.toHaveBeenCalled()
  })

  it.each<DetectionResult['kind']>(['mixed', 'correction_only'])(
    'masque les blocs du document reconnu comme %s et garde le mode progressif accessible',
    async (kind) => {
      detect.mockResolvedValue({ kind, blocks: [block], warnings: [], needsFallback: false })
      await importDocument()
      startAnalysis()
      expect(screen.getByTestId('page-cover')).toBeTruthy()
      await screen.findByText('1 bloc de corrigé détecté.')
      expect(screen.queryByTestId('page-cover')).toBeNull()
      expect(screen.getByTestId('correction-mask')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /Afficher le corrigé/ }))
      expect(screen.queryByTestId('correction-mask')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Révélation progressive' }))
      expect(screen.getByTestId('progressive-mask').style.top).toBe('0%')
    },
  )

  it('laisse visible le sujet reconnu sans corrigé', async () => {
    detect.mockResolvedValue({
      kind: 'statement_only',
      blocks: [],
      warnings: [],
      needsFallback: false,
    })
    await importDocument()
    startAnalysis()
    await screen.findByText('Aucun corrigé n’a été détecté.')
    expect(screen.queryByTestId('page-cover')).toBeNull()
    expect(screen.queryByTestId('correction-mask')).toBeNull()
  })

  it.each<DetectionResult['kind']>(['unknown', 'mixed'])(
    'active la révélation progressive pour un résultat incertain (%s)',
    async (kind) => {
      detect.mockResolvedValue({
        kind,
        blocks: kind === 'mixed' ? [block] : [],
        warnings: ['Une page ne contient pas de texte.'],
        needsFallback: true,
      })
      await importDocument()
      startAnalysis()
      await screen.findByText(
        'La détection est incertaine. Fais glisser le trait pour découvrir le document.',
      )
      expect(screen.getByText('Une page ne contient pas de texte.')).toBeTruthy()
      expect(screen.getByTestId('progressive-mask').style.top).toBe('0%')
    },
  )

  it('contient les rectangles partiellement hors page dans les limites du PDF', async () => {
    detect.mockResolvedValue({
      kind: 'mixed',
      blocks: [
        { ...block, regions: [{ pageIndex: 0, bbox: { x: -20, y: 540, width: 100, height: 90 } }] },
      ],
      warnings: [],
      needsFallback: false,
    })
    await importDocument()
    startAnalysis()
    const mask = await screen.findByTestId('correction-mask')
    expect(mask.style.left).toBe('0%')
    expect(mask.style.top).toBe('90%')
    expect(mask.style.width).toBe('20%')
    expect(mask.style.height).toBe('10%')
  })

  it.each([
    { ...block, regions: [{ ...block.regions[0], pageIndex: 6 }] },
    { ...block, regions: [{ pageIndex: 0, bbox: { x: 500, y: 20, width: 20, height: 20 } }] },
    { ...block, id: 'invalide', regions: [] },
  ])('couvre tout le PDF si un bloc ne peut pas être placé ($regions)', async (invalid) => {
    detect.mockResolvedValue({
      kind: 'mixed',
      blocks: [block, { ...invalid, id: 'zone-invalide' }],
      warnings: [],
      needsFallback: false,
    })
    await importDocument()
    startAnalysis()
    await screen.findByText(/Les masques ne peuvent pas être placés/)
    expect(screen.getByTestId('progressive-mask').style.top).toBe('0%')
    expect(screen.queryByTestId('correction-mask')).toBeNull()
    expect(screen.queryByRole('button', { name: /Afficher le corrigé/ })).toBeNull()
  })

  it('garde le document couvert si l’extraction échoue et permet la révélation progressive', async () => {
    const pdf = fakePdf()
    pdf.getPageData.mockRejectedValue(new Error('Extraction interrompue'))
    loadPdf.mockResolvedValue(pdf)
    await importDocument()
    startAnalysis()
    expect((await screen.findByRole('alert')).textContent).toContain('L’analyse a échoué')
    expect(screen.getByTestId('page-cover')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Révélation progressive' }))
    expect(screen.getByTestId('progressive-mask').style.top).toBe('0%')
  })

  it('n’affiche aucun document si l’ouverture du PDF échoue', async () => {
    loadPdf.mockRejectedValue(new Error('PDF invalide'))
    render(<App />)
    selectFile('invalide.pdf')
    expect((await screen.findByRole('alert')).textContent).toContain('Impossible d’ouvrir ce PDF')
    expect(screen.queryByRole('region', { name: 'Document PDF' })).toBeNull()
  })

  it('ferme un PDF dont l’ouverture se termine après un nouvel import', async () => {
    const first = fakePdf()
    let finishOpening!: (pdf: PdfDocument) => void
    loadPdf.mockReturnValueOnce(new Promise((resolve) => (finishOpening = resolve)))
    render(<App />)
    selectFile('premier.pdf')
    await waitFor(() => expect(loadPdf).toHaveBeenCalledOnce())
    selectFile('suivant.pdf')
    await screen.findByRole('heading', { name: 'suivant.pdf' })
    await act(async () => finishOpening(first))
    expect(first.close).toHaveBeenCalledOnce()
    expect(first.getPageDimensions).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'suivant.pdf' })).toBeTruthy()
    expect(screen.getByTestId('page-cover')).toBeTruthy()
  })

  it('ignore une analyse terminée après le passage en mode progressif', async () => {
    let finishDetection!: (result: DetectionResult) => void
    detect.mockReturnValueOnce(new Promise((resolve) => (finishDetection = resolve)))
    await importDocument()
    startAnalysis()
    await waitFor(() => expect(detect).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'Révélation progressive' }))
    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowDown' })
    await act(async () =>
      finishDetection({ kind: 'mixed', blocks: [block], warnings: [], needsFallback: false }),
    )
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('3')
    expect(screen.queryByTestId('correction-mask')).toBeNull()
  })
})
