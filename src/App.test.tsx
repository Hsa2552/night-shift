import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { detectCorrections } from './detection'
import { openPdf } from './pdf'
import type { PdfDocument } from './pdf'
import type { DetectionResult, PageData } from './shared/types'

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
  window.localStorage.clear()
})

describe('Unspoil', () => {
  it('mémorise le zoom, la navigation et le côté sans mémoriser le document', async () => {
    const firstApp = render(<App />)
    selectFile('annale-synthetique.pdf')
    await screen.findByRole('heading', { name: 'annale-synthetique.pdf' })
    const menu = screen.getByLabelText('Outils et raccourcis')
    fireEvent.click(menu)
    fireEvent.click(screen.getByRole('button', { name: 'Commandes à gauche' }))
    expect(screen.getByRole('main').dataset.correctionSide).toBe('left')
    fireEvent.click(screen.getByRole('button', { name: 'Navigation par page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom avant' }))
    const storage = window.localStorage
    expect(JSON.parse(storage.getItem('unspoil-reader-preferences')!)).toEqual({
      correctionSide: 'left',
      navigation: true,
      zoom: 125,
    })
    expect(Object.keys(storage)).toEqual(['unspoil-reader-preferences'])
    selectFile('nouveau.pdf')
    await screen.findByRole('heading', { name: 'nouveau.pdf' })
    expect(screen.getByText('125 %')).toBeTruthy()
    expect(screen.getByRole('main').dataset.correctionSide).toBe('left')
    expect(
      screen.getByRole('button', { name: 'Navigation par page' }).getAttribute('aria-expanded'),
    ).toBe('true')
    firstApp.unmount()
    await importDocument()
    expect(screen.getByText('125 %')).toBeTruthy()
    expect(screen.getByRole('main').dataset.correctionSide).toBe('left')
  })

  it('valide les préférences lues et les applique même quand le stockage est indisponible', async () => {
    window.localStorage.setItem(
      'unspoil-reader-preferences',
      JSON.stringify({
        zoom: 9999,
        correctionSide: 'sideways',
        navigation: 'closed',
        ignored: 'champ inconnu',
      }),
    )
    await importDocument()
    expect(screen.getByText('100 %')).toBeTruthy()
    expect(screen.getByRole('main').dataset.correctionSide).toBe('right')
    const refused = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Stockage indisponible')
    })
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom avant' }))
      expect(screen.getByText('125 %')).toBeTruthy()
      selectFile('suivant.pdf')
      await screen.findByRole('heading', { name: 'suivant.pdf' })
      expect(screen.getByText('125 %')).toBeTruthy()
    } finally {
      refused.mockRestore()
    }
  })

  it('ouvre le dialogue d’installation seulement lorsque le navigateur le propose', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: 'Installer Unspoil' })).toBeNull()
    expect(screen.getByText('Aide à l’installation')).toBeTruthy()
    const prompt = vi.fn().mockResolvedValue(undefined)
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt })
    act(() => window.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Installer Unspoil' }))
    expect(prompt).toHaveBeenCalledOnce()
    act(() => window.dispatchEvent(new Event('appinstalled')))
    expect(screen.queryByRole('button', { name: 'Installer Unspoil' })).toBeNull()
    expect(screen.queryByText('Aide à l’installation')).toBeNull()
  })

  it('permet de fermer puis retrouver l’aide sans révéler de corrigé', async () => {
    detect.mockResolvedValue({ kind: 'mixed', blocks: [block], warnings: [], needsFallback: false })
    await importDocument()
    startAnalysis()
    const help = await screen.findByRole('complementary', { name: 'Aide du lecteur' })
    fireEvent.click(within(help).getByRole('button', { name: 'Fermer l’aide' }))
    expect(help.isConnected).toBe(false)
    const menu = screen.getByLabelText('Outils et raccourcis')
    expect(document.activeElement).toBe(menu)
    fireEvent.click(menu)
    fireEvent.click(screen.getByRole('button', { name: 'Aide du lecteur' }))
    expect(document.activeElement).toBe(
      screen.getByRole('complementary', { name: 'Aide du lecteur' }),
    )
    expect(screen.getByTestId('correction-mask')).toBeTruthy()
  })

  it('ouvre l’annale synthétique couverte puis transmet ses pages au moteur', async () => {
    detect.mockResolvedValue({ kind: 'mixed', blocks: [block], warnings: [], needsFallback: false })
    render(<App />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Essayer avec une annale de démonstration' }),
    )
    await screen.findByRole('heading', { name: 'QCM de démonstration (synthétique).pdf' })
    const file = loadPdf.mock.calls[0]?.[0]
    expect(file).toMatchObject({
      name: 'QCM de démonstration (synthétique).pdf',
      type: 'application/pdf',
    })
    expect((file as File).size).toBeGreaterThan(0)
    expect(screen.getByTestId('page-cover')).toBeTruthy()
    expect(detect).not.toHaveBeenCalled()
    startAnalysis()
    expect(await screen.findByTestId('correction-mask')).toBeTruthy()
    expect(detect).toHaveBeenCalledWith(
      expect.objectContaining({ pages: [{ ...page, textItems: [] }] }),
    )
  })

  it('préserve le lecteur lors d’un dépôt invalide puis remplace le PDF lors d’un dépôt valide', async () => {
    const original = fakePdf()
    const replacement = fakePdf()
    loadPdf
      .mockResolvedValueOnce(original)
      .mockRejectedValueOnce(new Error('PDF invalide'))
      .mockResolvedValueOnce(replacement)
    detect.mockResolvedValue({ kind: 'mixed', blocks: [block], warnings: [], needsFallback: false })
    await importDocument()
    startAnalysis()
    fireEvent.click(await screen.findByRole('button', { name: /Afficher le corrigé/ }))
    const reader = screen.getByRole('main')
    const data = (name: string, type: string) => ({
      types: ['Files'],
      files: [new File(['synthétique'], name, { type })],
    })
    const invalidType = data('texte.txt', 'text/plain')
    fireEvent.dragEnter(reader, { dataTransfer: invalidType })
    expect(screen.getByText('Dépose un PDF pour remplacer le document ouvert')).toBeTruthy()
    expect(screen.getByText('1 / 1 correction révélée')).toBeTruthy()
    expect(fireEvent.drop(reader, { dataTransfer: invalidType })).toBe(false)
    expect(screen.getByRole('alert').textContent).toContain('Choisis un fichier PDF.')
    expect(loadPdf).toHaveBeenCalledOnce()
    fireEvent.drop(reader, { dataTransfer: data('illisible.pdf', 'application/pdf') })
    await screen.findByText(/Impossible d’ouvrir ce PDF/)
    expect(screen.getByText('1 / 1 correction révélée')).toBeTruthy()
    expect(original.close).not.toHaveBeenCalled()
    fireEvent.drop(reader, { dataTransfer: data('autre.pdf', 'application/pdf') })
    await screen.findByRole('heading', { name: 'autre.pdf' })
    expect(screen.getByTestId('page-cover')).toBeTruthy()
    expect(original.close).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Révélation progressive' }))
    expect(screen.queryByRole('button', { name: 'Mode entraînement' })).toBeNull()
    startAnalysis()
    await screen.findByTestId('correction-mask')
    expect(detect).toHaveBeenCalledTimes(2)
  })

  it('affiche les pages réellement extraites puis une analyse indéterminée', async () => {
    const pdf = fakePdf()
    pdf.pageCount = 2
    pdf.getPageDimensions.mockImplementation(async (pageIndex) => ({ ...page, pageIndex }))
    let extracted!: (data: PageData) => void
    pdf.getPageData
      .mockResolvedValueOnce({ ...page, textItems: [] })
      .mockReturnValueOnce(new Promise((resolve) => (extracted = resolve)))
    loadPdf.mockResolvedValueOnce(pdf)
    let finish!: (result: DetectionResult) => void
    detect.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
    await importDocument()
    startAnalysis()
    const progress = screen.getByRole<HTMLProgressElement>('progressbar', {
      name: 'Progression de l’analyse',
    })
    expect(progress.value).toBe(0)
    expect(progress.max).toBe(2)
    await screen.findByText('Extraction du texte — 1 / 2 pages')
    expect(progress.value).toBe(1)
    expect(screen.getAllByTestId('page-cover')).toHaveLength(2)
    await act(async () => extracted({ ...page, pageIndex: 1, textItems: [] }))
    await waitFor(() => expect(detect).toHaveBeenCalledOnce())
    expect(progress.hasAttribute('value')).toBe(false)
    expect(screen.getByText('Analyse des corrections…')).toBeTruthy()
    expect(screen.getAllByTestId('page-cover')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Annuler l’analyse' }))
    await act(async () =>
      finish({ kind: 'mixed', blocks: [block], warnings: [], needsFallback: false }),
    )
    expect(screen.queryByRole('progressbar', { name: 'Progression de l’analyse' })).toBeNull()
    expect(screen.getAllByTestId('page-cover')).toHaveLength(2)
  })

  it('confirme la révélation globale, puis retrouve les mêmes blocs masqués sans analyser à nouveau', async () => {
    const second = { ...block, id: 'q2', questionLabel: 'Question 2' }
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    detect.mockResolvedValue({
      kind: 'mixed',
      blocks: [block, second],
      warnings: [],
      needsFallback: false,
    })
    try {
      await importDocument()
      startAnalysis()
      await screen.findByText('0 / 2 corrections révélées')
      const revealAll = screen.getByRole('button', { name: 'Tout révéler' })
      fireEvent.click(revealAll)
      expect(screen.getAllByTestId('correction-mask')).toHaveLength(2)
      fireEvent.click(revealAll)
      expect(confirm).toHaveBeenCalledTimes(2)
      expect(screen.getByText('2 / 2 corrections révélées')).toBeTruthy()
      expect(screen.queryByTestId('correction-mask')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Tout remasquer' }))
      expect(screen.getAllByTestId('correction-mask')).toHaveLength(2)
      fireEvent.click(screen.getByRole('button', { name: 'Tout révéler' }))
      fireEvent.click(screen.getByRole('button', { name: 'Révélation progressive' }))
      expect(screen.getByTestId('progressive-mask').style.top).toBe('0%')
      fireEvent.click(screen.getByRole('button', { name: 'Mode entraînement' }))
      expect(screen.getAllByTestId('correction-mask')).toHaveLength(2)
      expect(detect).toHaveBeenCalledOnce()
    } finally {
      confirm.mockRestore()
    }
  })

  it('garde la navigation et le zoom sans le mode concentration', async () => {
    await importDocument()
    expect(screen.queryByRole('button', { name: 'Mode concentration' })).toBeNull()
    fireEvent.keyDown(screen.getByRole('main'), { key: 'F', altKey: true, shiftKey: true })
    expect(screen.getByRole('button', { name: 'Navigation par page' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Zoom avant' })).toBeTruthy()
  })
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

  it('exposes vector readers bound to the active document during detection', async () => {
    const first = {
      ...fakePdf(),
      getVectors: vi.fn().mockResolvedValue({ pageIndex: 0, width: 400 }),
    }
    const second = {
      ...fakePdf(),
      getVectors: vi.fn().mockResolvedValue({ pageIndex: 0, width: 200 }),
    }
    loadPdf.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    detect.mockResolvedValue({
      kind: 'statement_only',
      blocks: [],
      needsFallback: false,
      warnings: [],
    })
    await importDocument()
    expect(first.getVectors).not.toHaveBeenCalled()
    startAnalysis()
    await waitFor(() => expect(detect).toHaveBeenCalledTimes(1))
    const firstInput = detect.mock.calls[0]![0]
    await expect(firstInput.getVectors?.(0)).resolves.toMatchObject({ width: 400 })
    selectFile('nouveau.pdf')
    await screen.findByRole('heading', { name: 'nouveau.pdf' })
    expect(first.close).toHaveBeenCalledOnce()
    startAnalysis()
    await waitFor(() => expect(detect).toHaveBeenCalledTimes(2))
    await expect(detect.mock.calls[1]![0].getVectors?.(0)).resolves.toMatchObject({ width: 200 })
    expect(first.getVectors).toHaveBeenCalledOnce()
    expect(second.getVectors).toHaveBeenCalledOnce()
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

  it('saisit une page sans déclencher les raccourcis ni générer de miniature', async () => {
    const pdf = fakePdf()
    pdf.pageCount = 12
    pdf.getPageDimensions.mockImplementation(async (pageIndex) => ({ ...page, pageIndex }))
    loadPdf.mockResolvedValue(pdf)
    await importDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Navigation par page' }))
    const nav = screen.getByRole('navigation', { name: 'Pages du PDF' })
    const input = within(nav).getByRole('spinbutton', { name: 'Numéro de page' })
    fireEvent.keyDown(input, { key: 'PageDown', altKey: true, shiftKey: true })
    expect(screen.getByLabelText('Page 1 sur 12')).toBeTruthy()
    expect(nav.querySelector('canvas, img')).toBeNull()
    expect(nav.querySelectorAll('.page-tile')).toHaveLength(12)
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.submit(input.closest('form')!)
    expect(screen.getByLabelText('Page 10 sur 12')).toBeTruthy()
    expect(screen.getAllByTestId('page-cover')).toHaveLength(12)
    fireEvent.click(screen.getByRole('button', { name: 'Révélation progressive' }))
    fireEvent.click(screen.getByRole('button', { name: 'Navigation par page' }))
    expect(
      screen.getByRole('navigation', { name: 'Pages du PDF' }).querySelector('canvas, img'),
    ).toBeNull()
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
    expect(screen.queryByRole('button', { name: 'Tout afficher' })).toBeNull()
  })

  it('garde le PDF couvert si un r?sultat sujet seul renvoie aussi un corrig?', async () => {
    detect.mockResolvedValue({
      kind: 'statement_only',
      blocks: [block],
      warnings: [],
      needsFallback: false,
    })
    await importDocument()
    startAnalysis()
    const mask = await screen.findByTestId('progressive-mask')
    expect(mask.style.top).toBe('0%')
    expect(screen.queryByText('Aucun corrig? n?a ?t? d?tect?.')).toBeNull()
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
      const maskAgain = screen.getByRole<HTMLButtonElement>('button', {
        name: 'Masquer les corrigés',
      })
      expect(maskAgain.disabled).toBe(true)
      fireEvent.click(maskAgain)
      expect(detect).toHaveBeenCalledOnce()
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

  it('affiche et remasque tous les blocs sur plusieurs pages sans relancer l’analyse', async () => {
    const secondPage = { ...page, pageIndex: 1 }
    loadPdf.mockResolvedValueOnce({
      ...fakePdf(),
      pageCount: 2,
      getPageDimensions: vi.fn().mockResolvedValueOnce(page).mockResolvedValue(secondPage),
      getPageData: vi
        .fn()
        .mockResolvedValueOnce({ ...page, textItems: [] })
        .mockResolvedValue({ ...secondPage, textItems: [] }),
    })
    const groupedBlock = {
      ...block,
      regions: [
        ...block.regions,
        { pageIndex: 1, bbox: { x: 40, y: 100, width: 250, height: 60 } },
      ],
    }
    const next = {
      id: 'q2',
      questionLabel: 'Question 2',
      regions: [{ pageIndex: 1, bbox: { x: 40, y: 240, width: 250, height: 60 } }],
    }
    detect.mockResolvedValue({
      kind: 'mixed',
      blocks: [groupedBlock, next],
      warnings: [],
      needsFallback: false,
    })
    await importDocument()
    expect(screen.queryByRole('button', { name: 'Tout afficher' })).toBeNull()
    startAnalysis()
    const first = await screen.findByRole('button', { name: 'Afficher le corrigé — Question 1' })
    const second = screen.getByRole('button', { name: 'Afficher le corrigé — Question 2' })
    const showAll = screen.getByRole<HTMLButtonElement>('button', { name: 'Tout afficher' })
    const global = screen.getByRole<HTMLButtonElement>('button', { name: 'Tout remasquer' })
    expect(screen.getAllByTestId('correction-mask')).toHaveLength(3)
    expect(global.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Révéler dans le PDF — Question 1' }))
    expect(screen.getByText('1 / 2 corrections révélées')).toBeTruthy()
    expect(first.getAttribute('data-revealed')).toBe('true')
    expect(screen.getAllByTestId('correction-mask')).toHaveLength(1)
    expect(showAll.disabled).toBe(false)
    fireEvent.click(showAll)
    expect(screen.queryAllByTestId('correction-mask')).toHaveLength(0)
    expect(screen.getByText('2 / 2 corrections révélées')).toBeTruthy()
    expect(showAll.disabled).toBe(true)
    fireEvent.click(second)
    expect(first.getAttribute('data-revealed')).toBe('true')
    expect(screen.getAllByTestId('correction-mask')).toHaveLength(1)
    expect(showAll.disabled).toBe(false)
    expect(global.disabled).toBe(false)
    fireEvent.click(global)
    expect(detect).toHaveBeenCalledOnce()
    expect(screen.getAllByTestId('correction-mask')).toHaveLength(3)
    expect(screen.getByText('0 / 2 corrections révélées')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Afficher le corrigé — Question 1' })).toBe(first)
    expect(global.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Révélation progressive' }))
    expect(screen.queryByRole('button', { name: 'Tout afficher' })).toBeNull()
    expect(screen.getAllByTestId('progressive-mask')).toHaveLength(2)
  })
})
