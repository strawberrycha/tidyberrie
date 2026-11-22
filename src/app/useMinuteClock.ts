import { useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

export function useMinuteClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let active = true
    function tick() {
      if (!active) return
      clearTimeout(timer)
      const next = new Date()
      setNow(next)
      timer = setTimeout(tick, 60_000 - (next.getTime() % 60_000))
    }
    tick()
    document.addEventListener('visibilitychange', tick)
    const listener = Capacitor.isNativePlatform() ? App.addListener('appStateChange', state => {
      if (state.isActive) tick()
    }) : undefined
    return () => {
      active = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', tick)
      void listener?.then(handle => handle.remove()).catch(() => {})
    }
  }, [])
  return now
}
