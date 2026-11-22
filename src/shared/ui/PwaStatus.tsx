import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useToast } from './Toast'

type InstallPrompt = Event & {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaStatus() {
  const { offlineReady: [ready, setReady], needRefresh: [update], updateServiceWorker } = useRegisterSW()
  const [offer, setOffer] = useState<InstallPrompt>()
  const show = useToast()

  useEffect(() => {
    if (ready) {
      show({ message: 'Ready to work offline.' })
      setReady(false)
    }
  }, [ready, setReady, show])

  useEffect(() => {
    function available(event: Event) {
      event.preventDefault()
      setOffer(event as InstallPrompt)
    }
    const installed = () => setOffer(undefined)
    window.addEventListener('beforeinstallprompt', available)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', available)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  return (update || offer) && <aside className="update actions" aria-label="App options">
    {update && <>
      <span role="status">Update available</span>
      <button className="secondary" type="button" onClick={() => void updateServiceWorker(true).catch(() =>
        show({ message: 'Could not apply the update.' }))}>Reload to update</button>
    </>}
    {offer && <button className="secondary" type="button" onClick={() => {
      setOffer(undefined)
      void offer.prompt().catch(() => show({ message: 'Use your browser menu to install Tidyberrie.' }))
    }}>Install Tidyberrie</button>}
  </aside>
}
