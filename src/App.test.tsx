import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  window.localStorage.removeItem('unspoil-theme')
})

describe('Unspoil', () => {
  it('importe un PDF glissé sur la zone prévue et garde ses pages couvertes', async () => {
    render(<App />)
    const zone = screen.getByLabelText('Importer un PDF').closest('.file-drop')!
    const file = new File(['synthétique'], 'depose.pdf', { type: 'application/pdf' })
    const dataTransfer = { types: ['Files'], files: [file], dropEffect: 'none' }
    fireEvent.dragOver(zone, { dataTransfer })
    expect(screen.getByText('Dépose ton PDF ici')).toBeTruthy()
    fireEvent.drop(zone, { dataTransfer })
    await screen.findByRole('heading', { name: 'depose.pdf' })
    expect(loadPdf).toHaveBeenCalledWith(file)
    expect(screen.getByTestId('page-cover')).toBeTruthy()
  })

  it('conserve la révélation et le PDF lors d’un changement de thème', async () => {
    detect.mockResolvedValue({ kind: 'mixed', blocks: [block], warnings: [], needsFallback: false })
    await importDocument()
    startAnalysis()
    const reveal = await screen.findByRole('button', { name: /Afficher le corrigé/ })
    fireEvent.click(reveal)
    expect(screen.getByText('1 / 1 correction révélée')).toBeTruthy()
    const previous = document.documentElement.dataset.theme
    fireEvent.click(screen.getByRole('button', { name: /Passer au thème/ }))
    const next = document.documentElement.dataset.theme
    expect(next).not.toBe(previous)
    expect(window.localStorage.getItem('unspoil-theme')).toBe(next)
    expect(loadPdf).toHaveBeenCalledOnce()
    expect(screen.getByText('1 / 1 correction révélée')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Remasquer le corrigé/ }))
    expect(screen.getByText('0 / 1 correction révélée')).toBeTruthy()
    expect(screen.getByTestId('correction-mask')).toBeTruthy()
  })

  it('navigue sans miniature rendue et garde le document couvert au zoom', async () => {
    const pdf = fakePdf()
    pdf.pageCount = 2
    pdf.getPageDimensions.mockImplementation(async (pageIndex) => ({ ...page, pageIndex }))
    loadPdf.mockResolvedValue(pdf)
    await importDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Navigation par page' }))
    const nav = screen.getByRole('navigation', { name: 'Pages du PDF' })
    expect(nav.querySelector('canvas, img')).toBeNull()
    fireEvent.click(within(nav).getByRole('button', { name: 'Aller à la page 2' }))
    expect(screen.queryByRole('navigation', { name: 'Pages du PDF' })).toBeNull()
    expect(screen.getByLabelText('Page 2 sur 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Zoom avant' }))
    expect(screen.getByText('125 %')).toBeTruthy()
    expect(screen.getAllByTestId('page-cover')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Ajuster à la largeur' }))
    expect(screen.getByText('100 %')).toBeTruthy()
  })

  it('ne découvre rien après l’annulation explicite d’une analyse en cours', async () => {
    let finish!: (result: DetectionResult) => void
    detect.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    await importDocument()
    startAnalysis()
    await waitFor(() => expect(detect).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'Annuler l’analyse' }))
    await act(async () =>
      finish({ kind: 'statement_only', blocks: [], warnings: [], needsFallback: false }),
    )
    expect(screen.getByText('Analyse annulée. Le document reste couvert.')).toBeTruthy()
    expect(screen.getByTestId('page-cover')).toBeTruthy()
  })

  it('ferme le document si son ouverture se termine après une annulation', async () => {
    const pdf = fakePdf()
    let finish!: (value: PdfDocument) => void
    loadPdf.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    render(<App />)
    selectFile('a-annuler.pdf')
    await waitFor(() => expect(loadPdf).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    await act(async () => finish(pdf))
    expect(pdf.close).toHaveBeenCalledOnce()
    expect(screen.queryByTestId('page-cover')).toBeNull()
    expect(screen.getByLabelText('Importer un PDF')).toBeTruthy()
  })

  it('explique comment reprendre après le refus d’un PDF chiffré', async () => {
    const passwordError = new Error('Password required')
    passwordError.name = 'PasswordException'
    loadPdf.mockRejectedValueOnce(passwordError)
    render(<App />)
    selectFile('chiffre.pdf')
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Importe une copie déverrouillée.',
    )
    expect(screen.queryByTestId('page-cover')).toBeNull()
  })

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
