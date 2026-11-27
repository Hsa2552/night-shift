import { useEffect, useState } from 'react'
import { Icon } from './Icon'

type Theme = 'light' | 'dark'

function savedTheme(): Theme | null {
  try {
    const theme = window.localStorage.getItem('unspoil-theme')
    return theme === 'light' || theme === 'dark' ? theme : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [preference, setPreference] = useState(savedTheme)
  const [system, setSystem] = useState(systemTheme)
  const theme = preference ?? system

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const update = () => setSystem(systemTheme())
    media?.addEventListener('change', update)
    return () => media?.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0B1020' : '#F8FAFC')
  }, [theme])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setPreference(next)
    try {
      window.localStorage.setItem('unspoil-theme', next)
    } catch {
      // The preference still applies to the current session.
    }
  }

  const label = theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'
  return (
    <button
      className="icon-button theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  )
}

export function Brand({ onHome }: { onHome?: () => void }) {
  const mark = (
    <>
      <img
        className="brand-light"
        src={`${import.meta.env.BASE_URL}brand/unspoil-clair.svg`}
        alt=""
      />
      <img
        className="brand-dark"
        src={`${import.meta.env.BASE_URL}brand/unspoil-sombre.svg`}
        alt=""
      />
    </>
  )
  return onHome ? (
    <button className="brand" type="button" onClick={onHome} aria-label="Unspoil, accueil">
      {mark}
    </button>
  ) : (
    <span className="brand" role="img" aria-label="Unspoil">
      {mark}
    </span>
  )
}
