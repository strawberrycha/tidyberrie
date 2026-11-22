import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useToast } from './Toast'

export function PwaStatus() {
  const { offlineReady: [ready, setReady], needRefresh: [update], updateServiceWorker } = useRegisterSW()
  const show = useToast()

  useEffect(() => {
    if (ready) {
      show({ message: 'Ready to work offline.' })
      setReady(false)
    }
  }, [ready, setReady, show])

  return update && <aside className="update" aria-label="App update">
    <span role="status">Update available</span>
    <button className="secondary" type="button" onClick={() => void updateServiceWorker(true).catch(() =>
      show({ message: 'Could not apply the update.' }))}>Reload to update</button>
  </aside>
}
