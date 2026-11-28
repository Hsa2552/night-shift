export function PwaInstallation({
  installed,
  install,
}: {
  installed: boolean
  install?: () => void
}) {
  if (installed) return null
  if (install) {
    return (
      <button type="button" className="home-install-action" onClick={install}>
        Installer Unspoil
      </button>
    )
  }

  const isAppleMobile =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return (
    <details className="home-install-help">
      <summary>Aide à l’installation</summary>
      <p>
        {isAppleMobile
          ? 'Ouvre Unspoil dans Safari. Touche Partager, puis Sur l’écran d’accueil. Active « Ouvrir comme app web » si l’option est proposée.'
          : 'Si ton navigateur propose l’installation, ouvre son menu et choisis Installer ou Ajouter à l’écran d’accueil.'}
      </p>
    </details>
  )
}
