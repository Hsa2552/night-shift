import { useState } from 'react'
import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import { DemoPreview } from './DemoPreview'
import { Icon } from './Icon'

export function FileInput({
  children,
  onFile,
  className,
}: {
  children: ReactNode
  onFile: (file: File) => void
  className: string
}) {
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) onFile(file)
  }

  return (
    <label className={className}>
      <input type="file" accept="application/pdf,.pdf" onChange={chooseFile} />
      {children}
    </label>
  )
}

export function Home({
  onFile,
  onDemo,
  installation,
  pending,
  onCancel,
  error,
}: {
  onFile: (file: File) => void
  onDemo: () => void
  installation: ReactNode
  pending: File | null
  onCancel: () => void
  error: string
}) {
  const [dragging, setDragging] = useState(false)

  function dragOver(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDragging(true)
  }

  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return (
    <main id="main-content" className="home" tabIndex={-1}>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-grid">
          <div className="home-intro">
            <h1 id="home-title">
              Révise sans
              <br />
              <em>te spoiler.</em>
            </h1>
            <p className="home-lead">
              Transforme tes annales corrigées en sujets d’entraînement, directement sur ton
              appareil.
            </p>

            <div
              className="file-drop"
              data-dragging={dragging || undefined}
              onDragOver={dragOver}
              onDragLeave={(event) => {
                if (
                  !(event.relatedTarget instanceof Node) ||
                  !event.currentTarget.contains(event.relatedTarget)
                )
                  setDragging(false)
              }}
              onDrop={drop}
            >
              <FileInput className="ui-button ui-primary" onFile={onFile}>
                <Icon name="upload" /> Importer un PDF
              </FileInput>
              <span className="drop-hint">
                {dragging ? 'Dépose ton PDF ici' : 'ou glisse-le ici'}
              </span>
            </div>
            <button
              type="button"
              className="ui-button home-demonstration"
              disabled={!!pending}
              onClick={onDemo}
            >
              <Icon name="file" /> Essayer avec une annale de démonstration
            </button>
            <p className="home-demo-note">QCM synthétique</p>
            <p className="home-privacy">
              <Icon name="lock" size={15} /> Tes fichiers restent sur ton appareil.
            </p>

            {installation}
            {pending && (
              <div className="home-feedback" role="status">
                <span className="loading-ring" aria-hidden="true" />
                <div>
                  <strong>{pending.name}</strong>
                  <p>
                    {pending.size > 30 * 1024 ** 2
                      ? 'Ouverture du PDF volumineux…'
                      : 'Ouverture du PDF…'}
                  </p>
                </div>
                <button className="ui-button ui-small" type="button" onClick={onCancel}>
                  Annuler
                </button>
              </div>
            )}
            {error && (
              <p className="ui-error" role="alert">
                <Icon name="alert" />
                {error}
              </p>
            )}
          </div>

          <DemoPreview />
        </div>
      </section>

      <section className="home-guide" id="fonctionnement" aria-labelledby="guide-title">
        <h2 id="guide-title">Comment ça marche</h2>
        <ol>
          <li>
            <Icon name="upload" />
            <div>
              <strong>Importe</strong>
              <p>Choisis une annale au format PDF.</p>
            </div>
          </li>
          <li>
            <Icon name="eye-off" />
            <div>
              <strong>Masque</strong>
              <p>Unspoil repère et couvre les corrigés.</p>
            </div>
          </li>
          <li>
            <Icon name="eye" />
            <div>
              <strong>Révise</strong>
              <p>Révèle les corrections quand tu es prêt.</p>
            </div>
          </li>
        </ol>
      </section>
    </main>
  )
}
