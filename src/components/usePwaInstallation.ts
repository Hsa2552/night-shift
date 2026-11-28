import { useEffect, useState } from 'react'

interface InstallRequest extends Event {
  prompt(): Promise<unknown>
}

export function usePwaInstallation() {
  const [request, setRequest] = useState<InstallRequest>()
  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  )

  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)')
    const capture = (event: Event) => {
      const prompt = event as InstallRequest
      if (typeof prompt.prompt !== 'function') return
      event.preventDefault()
      setRequest(prompt)
    }
    const complete = () => {
      setInstalled(true)
      setRequest(undefined)
    }
    const displayChanged = () => {
      if (standalone?.matches) complete()
    }
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', complete)
    standalone?.addEventListener('change', displayChanged)
    return () => {
      window.removeEventListener('beforeinstallprompt', capture)
      window.removeEventListener('appinstalled', complete)
      standalone?.removeEventListener('change', displayChanged)
    }
  }, [])

  function install() {
    if (!request) return
    setRequest(undefined)
    void request.prompt().catch(() => undefined)
  }

  return { installed, install: request ? install : undefined }
}
