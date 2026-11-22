import { useEffect, useSyncExternalStore } from 'react'
import { syncAvailable } from './availability'
import { connect, enable, getSnapshot, resumeEnabled, signIn, subscribe, syncNow, turnOff } from './service'

export function useSync() {
  const available = syncAvailable()
  const view = useSyncExternalStore(subscribe, getSnapshot)
  useEffect(() => { if (available) void connect() }, [available])
  return { ...view, available, connect, enable, signIn, syncNow, turnOff }
}

export function SyncStartup() {
  useEffect(() => {
    if (!syncAvailable()) return
    function foreground() {
      if (document.visibilityState === 'visible') void syncNow()
    }
    function connection() { void syncNow() }
    void resumeEnabled().catch(() => {})
    const clock = window.setInterval(foreground, 120_000)
    document.addEventListener('visibilitychange', foreground)
    window.addEventListener('online', connection)
    window.addEventListener('offline', connection)
    return () => {
      window.clearInterval(clock)
      document.removeEventListener('visibilitychange', foreground)
      window.removeEventListener('online', connection)
      window.removeEventListener('offline', connection)
    }
  }, [])
  return null
}
