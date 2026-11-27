import { useEffect, useRef, useState } from 'react'
import { Brand, ThemeToggle } from './components/Brand'
import { FileInput, Home } from './components/Home'
import type { PdfDocument } from './pdf'
import type { PageData, PageDimensions } from './shared/types'
import { clipCorrectionBlocks } from './viewer/correctionGeometry'
import { DocumentViewer } from './viewer/DocumentViewer'
import type { ViewerMode } from './viewer/DocumentViewer'
import { PdfCanvas } from './viewer/PdfCanvas'

interface OpenDocument {
  id: number
  name: string
  pdf: PdfDocument
  pages: PageDimensions[]
}

function closePdf(pdf: PdfDocument) {
  void pdf.close().catch(() => undefined)
}

export default function App() {
  const [document, setDocument] = useState<OpenDocument>()
  const [mode, setMode] = useState<ViewerMode>({ kind: 'covered' })
  const [busy, setBusy] = useState<'opening' | 'detecting'>()
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState('')
  const currentPdf = useRef<PdfDocument | null>(null)
  const revision = useRef(0)

  useEffect(() => {
    return () => {
      revision.current += 1
      if (currentPdf.current) closePdf(currentPdf.current)
      currentPdf.current = null
    }
  }, [])

  function returnHome() {
    revision.current += 1
    if (currentPdf.current) closePdf(currentPdf.current)
    currentPdf.current = null
    setDocument(undefined)
    setPendingFile(null)
    setBusy(undefined)
    setMode({ kind: 'covered' })
    setMessage('')
    setWarnings([])
    setError('')
  }

  async function importPdf(file: File) {
    const request = ++revision.current
    if (currentPdf.current) closePdf(currentPdf.current)
    currentPdf.current = null
    setDocument(undefined)
    setMode({ kind: 'covered' })
    setMessage('')
    setWarnings([])
    setError('')
    setPendingFile(null)

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setBusy(undefined)
      setError('Choisis un fichier PDF.')
      return
    }

    setBusy('opening')
    setPendingFile(file)
    try {
      const { openPdf } = await import('./pdf')
      if (request !== revision.current) return
      const pdf = await openPdf(file)
      if (request !== revision.current) {
        closePdf(pdf)
        return
      }
      currentPdf.current = pdf
      const pages: PageDimensions[] = []
      for (let index = 0; index < pdf.pageCount; index += 1) {
        const page = await pdf.getPageDimensions(index)
        if (request !== revision.current) return
        if (![page.width, page.height].every((size) => Number.isFinite(size) && size > 0)) {
          throw new Error('Dimensions de page invalides')
        }
        pages.push(page)
      }
      if (pages.length === 0) throw new Error('Document vide')
      setDocument({ id: request, name: file.name, pdf, pages })
    } catch (cause) {
      if (request !== revision.current) return
      if (currentPdf.current) closePdf(currentPdf.current)
      currentPdf.current = null
      setError(
        cause instanceof Error && cause.name === 'PasswordException'
          ? 'Ce PDF est protégé par un mot de passe. Importe une copie déverrouillée.'
          : 'Impossible d’ouvrir ce PDF. Vérifie que le fichier s’ouvre, puis réessaie.',
      )
    } finally {
      if (request === revision.current) {
        setBusy(undefined)
        setPendingFile(null)
      }
    }
  }

  async function maskCorrections() {
    if (!document) return
    const request = ++revision.current
    setMode({ kind: 'covered' })
    setBusy('detecting')
    setError('')
    setMessage('')
    setWarnings([])

    try {
      const pages: PageData[] = []
      for (const { pageIndex } of document.pages) {
        pages.push(await document.pdf.getPageData(pageIndex))
        if (request !== revision.current) return
      }
      const { detectCorrections } = await import('./detection')
      if (request !== revision.current) return
      const result = await detectCorrections({
        pages,
        getRaster: (index) => document.pdf.getRaster(index),
      })
      if (request !== revision.current) return
      setWarnings(result.warnings)

      if (result.kind === 'unknown' || result.needsFallback) {
        setMessage('La détection est incertaine. Fais glisser le trait pour découvrir le document.')
        setMode({ kind: 'progressive' })
        return
      }

      if (result.kind === 'statement_only') {
        setMessage('Aucun corrigé n’a été détecté.')
        setMode({ kind: 'automatic', blocks: [] })
        return
      }

      const blocks = clipCorrectionBlocks(result.blocks, document.pages)
      if (!blocks?.length) {
        setMessage(
          'Les masques ne peuvent pas être placés. Fais glisser le trait pour lire le PDF.',
        )
        setMode({ kind: 'progressive' })
        return
      }

      const count = blocks.length
      setMessage(count === 1 ? '1 bloc de corrigé détecté.' : `${count} blocs de corrigé détectés.`)
      setMode({ kind: 'automatic', blocks })
    } catch {
      if (request !== revision.current) return
      setError('L’analyse a échoué. La révélation progressive reste disponible.')
    } finally {
      if (request === revision.current) setBusy(undefined)
    }
  }

  function showProgressively() {
    if (mode.kind === 'progressive') return
    revision.current += 1
    setBusy(undefined)
    setError('')
    setMessage('')
    setWarnings([])
    setMode({ kind: 'progressive' })
  }

  let status = message
  if (busy === 'opening') status = 'Ouverture du PDF…'
  else if (busy === 'detecting') status = 'Analyse du PDF…'
  else if (!message && mode.kind === 'progressive') {
    status = 'Fais glisser le trait pour découvrir le document.'
  } else if (!message && !error && document && mode.kind === 'covered') {
    status = 'Le PDF est couvert. Choisis comment le découvrir.'
  }

  return (
    <div
      className="unspoil"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault()
      }}
      onDrop={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault()
      }}
    >
      <a className="skip-link" href="#main-content">
        Aller au contenu
      </a>
      <header className="unspoil-header">
        <div className="site-header-inner">
          <Brand onHome={document ? returnHome : undefined} />
          <div className="site-header-controls">
            {!document && <a href="#fonctionnement">Comment ça marche</a>}
            <ThemeToggle />
          </div>
        </div>
      </header>
      {document ? (
        <main className="unspoil-main" id="main-content" tabIndex={-1}>
          <section className="unspoil-toolbar">
            <h1 className="unspoil-filename">{document.name}</h1>
            <div className="unspoil-actions">
              <>
                <button
                  className="unspoil-button unspoil-button-primary"
                  type="button"
                  disabled={busy === 'detecting' || mode.kind === 'automatic'}
                  onClick={() => void maskCorrections()}
                >
                  Masquer les corrigés
                </button>
                <button
                  className="unspoil-button"
                  type="button"
                  aria-pressed={mode.kind === 'progressive'}
                  aria-disabled={mode.kind === 'progressive'}
                  onClick={showProgressively}
                >
                  Révélation progressive
                </button>
              </>
              <FileInput className="unspoil-button" onFile={importPdf}>
                Changer de PDF
              </FileInput>
            </div>
            <p role="status" className="unspoil-status">
              {status}
            </p>
            {error && (
              <p role="alert" className="unspoil-error">
                {error}
              </p>
            )}
            {warnings.length > 0 && (
              <ul className="unspoil-warnings">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            )}
          </section>
          <DocumentViewer
            key={document.id}
            pages={document.pages}
            mode={mode}
            renderPage={(page) => <PdfCanvas pdf={document.pdf} page={page} />}
          />
        </main>
      ) : (
        <Home onFile={importPdf} pending={pendingFile} onCancel={returnHome} error={error} />
      )}
    </div>
  )
}
