import { useEffect, useRef, useState } from 'react'
import demonstration from './detection/samples/qcm-cases.pdf?inline'
import { Brand, ThemeToggle } from './components/Brand'
import { FileInput, Home } from './components/Home'
import { Icon } from './components/Icon'
import type { PdfDocument } from './pdf'
import type { PageData, PageDimensions } from './shared/types'
import { decideDetection } from './viewer/detectionDecision'
import type { ViewerMode } from './viewer/DocumentViewer'
import { Reader, type AnalysisProgress } from './viewer/Reader'

interface OpenDocument {
  id: number
  name: string
  pdf: PdfDocument
  pages: PageDimensions[]
}

interface Training {
  mode: Extract<ViewerMode, { kind: 'automatic' }>
  message: string
  warnings: string[]
  kindLabel: string
}

function closePdf(pdf: PdfDocument) {
  void pdf.close().catch(() => undefined)
}

export default function App() {
  const [document, setDocument] = useState<OpenDocument>()
  const [mode, setMode] = useState<ViewerMode>({ kind: 'covered' })
  const [analysis, setAnalysis] = useState<AnalysisProgress>()
  const [training, setTraining] = useState<Training>()
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [kindLabel, setKindLabel] = useState('')
  const [error, setError] = useState('')
  const currentPdf = useRef<PdfDocument | null>(null)
  const revision = useRef(0)
  const openingRevision = useRef(0)
  const openingPdf = useRef<PdfDocument | null>(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    return () => {
      revision.current += 1
      openingRevision.current += 1
      if (openingPdf.current) closePdf(openingPdf.current)
      openingPdf.current = null
      if (currentPdf.current) closePdf(currentPdf.current)
      currentPdf.current = null
    }
  }, [])

  function returnHome() {
    revision.current += 1
    if (currentPdf.current) closePdf(currentPdf.current)
    currentPdf.current = null
    setDocument(undefined)
    openingRevision.current += 1
    if (openingPdf.current) closePdf(openingPdf.current)
    openingPdf.current = null
    setPendingFile(null)
    setAnalysis(undefined)
    setTraining(undefined)
    dragDepth.current = 0
    setDragging(false)
    setMode({ kind: 'covered' })
    setMessage('')
    setWarnings([])
    setError('')
    setKindLabel('')
    if (typeof HTMLElement.prototype.scrollIntoView === 'function') window.scrollTo(0, 0)
  }

  async function importPdf(file: File) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Choisis un fichier PDF.')
      return
    }

    const request = ++openingRevision.current
    if (openingPdf.current) closePdf(openingPdf.current)
    openingPdf.current = null
    setError('')
    setPendingFile(file)
    try {
      const { openPdf } = await import('./pdf')
      if (request !== openingRevision.current) return
      const pdf = await openPdf(file)
      if (request !== openingRevision.current) {
        closePdf(pdf)
        return
      }
      openingPdf.current = pdf
      const pages: PageDimensions[] = []
      for (let index = 0; index < pdf.pageCount; index += 1) {
        const page = await pdf.getPageDimensions(index)
        if (request !== openingRevision.current) return
        if (![page.width, page.height].every((size) => Number.isFinite(size) && size > 0)) {
          throw new Error('Dimensions de page invalides')
        }
        pages.push(page)
      }
      if (pages.length === 0) throw new Error('Document vide')

      // Commit the replacement only when PDF.js has opened and validated the page geometry.
      revision.current += 1
      if (currentPdf.current) closePdf(currentPdf.current)
      currentPdf.current = pdf
      openingPdf.current = null
      setDocument({ id: request, name: file.name, pdf, pages })
      setMode({ kind: 'covered' })
      setTraining(undefined)
      setAnalysis(undefined)
      setMessage('')
      setWarnings([])
      setKindLabel('')
      setError('')
    } catch (cause) {
      if (request !== openingRevision.current) return
      setError(
        cause instanceof Error && cause.name === 'PasswordException'
          ? 'Ce PDF est protégé par un mot de passe. Importe une copie déverrouillée.'
          : 'Impossible d’ouvrir ce PDF. Vérifie que le fichier s’ouvre, puis réessaie.',
      )
    } finally {
      if (request === openingRevision.current) {
        if (openingPdf.current) closePdf(openingPdf.current)
        openingPdf.current = null
        setPendingFile(null)
      }
    }
  }

  function tryDemonstration() {
    const encoded = demonstration.slice(demonstration.indexOf(',') + 1)
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
    void importPdf(
      new File([bytes], 'QCM de démonstration (synthétique).pdf', { type: 'application/pdf' }),
    )
  }

  function startTraining(presentation: Training) {
    setMode(presentation.mode)
    setMessage(presentation.message)
    setWarnings(presentation.warnings)
    setKindLabel(presentation.kindLabel)
    setError('')
  }

  async function maskCorrections() {
    if (!document || analysis) return
    if (training) {
      startTraining(training)
      return
    }
    const request = ++revision.current
    setMode({ kind: 'covered' })
    setAnalysis({ phase: 'extract', extracted: 0, total: document.pages.length })
    setError('')
    setMessage('')
    setWarnings([])
    setKindLabel('')

    try {
      const pages: PageData[] = []
      for (const { pageIndex } of document.pages) {
        pages.push(await document.pdf.getPageData(pageIndex))
        if (request !== revision.current) return
        setAnalysis({ phase: 'extract', extracted: pages.length, total: document.pages.length })
      }
      setAnalysis({ phase: 'detect' })
      const { detectCorrections } = await import('./detection')
      if (request !== revision.current) return
      const result = await detectCorrections({
        pages,
        getRaster: (index) => document.pdf.getRaster(index),
        getVectors: document.pdf.getVectors?.bind(document.pdf),
      })
      if (request !== revision.current) return
      setWarnings(result.warnings)

      const decision = decideDetection(result, document.pages)
      if (decision.kind === 'progressive') {
        setKindLabel('Lecture progressive')
        setMessage(
          decision.reason === 'uncertain'
            ? 'La détection est incertaine. Fais glisser le trait pour découvrir le document.'
            : 'Les masques ne peuvent pas être placés. Fais glisser le trait pour lire le PDF.',
        )
        setMode({ kind: 'progressive' })
        return
      }

      const blocks = decision.kind === 'automatic' ? decision.blocks : []
      const count = blocks.length
      const presentation: Training = {
        mode: { kind: 'automatic', blocks },
        message:
          decision.kind === 'statement_only'
            ? 'Aucun corrigé n’a été détecté.'
            : count === 1
              ? '1 bloc de corrigé détecté.'
              : count + ' blocs de corrigé détectés.',
        warnings: result.warnings,
        kindLabel:
          decision.kind === 'statement_only'
            ? ''
            : result.kind === 'correction_only'
              ? 'Corrigé seul'
              : 'Sujet et corrections',
      }
      setTraining(presentation)
      startTraining(presentation)
    } catch {
      if (request !== revision.current) return
      setError('L’analyse a échoué. La révélation progressive reste disponible.')
    } finally {
      if (request === revision.current) setAnalysis(undefined)
    }
  }

  function showProgressively() {
    if (mode.kind === 'progressive') return
    revision.current += 1
    setAnalysis(undefined)
    setError('')
    setMessage('')
    setWarnings([])
    setKindLabel('Lecture progressive')
    setMode({ kind: 'progressive' })
  }

  function cancelAnalysis() {
    revision.current += 1
    setAnalysis(undefined)
    setMessage('Analyse annulée. Le document reste couvert.')
  }

  let status = message
  if (analysis?.phase === 'extract') {
    status = 'Extraction du texte — ' + analysis.extracted + ' / ' + analysis.total + ' pages'
  } else if (analysis?.phase === 'detect') status = 'Analyse des corrections…'
  else if (pendingFile) status = 'Ouverture du nouveau PDF…'
  else if (!message && mode.kind === 'progressive') {
    status = 'Fais glisser le trait pour découvrir le document.'
  } else if (!message && !error && document && mode.kind === 'covered') {
    status = 'Le PDF est couvert. Choisis comment le découvrir.'
  }

  return (
    <div
      className="unspoil"
      data-workspace={document ? true : undefined}
      onDragEnter={(event) => {
        if (!document || !event.dataTransfer.types.includes('Files')) return
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragLeave={() => {
        if (dragDepth.current > 0) dragDepth.current -= 1
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(event) => {
        const file = event.dataTransfer.files[0]
        if (file || event.dataTransfer.types.includes('Files')) event.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        if (document && file) void importPdf(file)
      }}
    >
      <a className="skip-link" href="#main-content">
        Aller au contenu
      </a>
      <header className="unspoil-header">
        <div className="site-header-inner">
          <Brand onHome={document ? returnHome : undefined} />
          {document && (
            <h1 className="workspace-filename" title={document.name}>
              <Icon name="file" size={17} />
              <span>{document.name}</span>
            </h1>
          )}
          <div className="site-header-controls">
            {document ? (
              <FileInput className="ui-button replace-file" onFile={importPdf}>
                <Icon name="upload" size={17} />
                <span>Changer de PDF</span>
              </FileInput>
            ) : (
              <a href="#fonctionnement">Comment ça marche</a>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      {document ? (
        <Reader
          key={document.id}
          pdf={document.pdf}
          pages={document.pages}
          mode={mode}
          analysis={analysis}
          trainingAvailable={!!training}
          replacing={!!pendingFile}
          status={status}
          kindLabel={kindLabel}
          warnings={warnings}
          error={error}
          onAnalyze={() => void maskCorrections()}
          onProgressive={showProgressively}
          onCancel={cancelAnalysis}
        />
      ) : (
        <Home
          onFile={importPdf}
          onDemo={tryDemonstration}
          pending={pendingFile}
          onCancel={returnHome}
          error={error}
        />
      )}
      {document && dragging && (
        <div className="reader-drop-overlay" role="status">
          <p>
            <Icon name="upload" size={24} /> Dépose un PDF pour remplacer le document ouvert
          </p>
        </div>
      )}
    </div>
  )
}
