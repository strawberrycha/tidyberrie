import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { initializeSettings, setTheme, setWeekStart } from '../../features/settings/service'
import { applyTheme } from './tokens'
import type { Theme } from './tokens'

type Preferences = Awaited<ReturnType<typeof initializeSettings>>
type ThemeState = {
  preferences?: Preferences
  error: boolean
  refresh: () => Promise<void>
  chooseTheme: (theme: Theme) => Promise<void>
  chooseWeekStart: (weekStart: number) => Promise<void>
}

const ThemeContext = createContext<ThemeState | null>(null)

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('Theme provider missing')
  return value
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>()
  const [error, setError] = useState(false)

  async function refresh() {
    setPreferences(await initializeSettings())
  }

  useEffect(() => {
    let active = true
    initializeSettings().then(
      value => { if (active) setPreferences(value) },
      () => { if (active) setError(true) },
    )
    function syncUpdated() {
      void initializeSettings().then(value => { if (active) setPreferences(value) }, () => {})
    }
    window.addEventListener('tidyberrie-sync-updated', syncUpdated)
    return () => {
      active = false
      window.removeEventListener('tidyberrie-sync-updated', syncUpdated)
    }
  }, [])

  useEffect(() => {
    if (preferences) applyTheme(preferences.theme)
  }, [preferences])

  async function chooseTheme(theme: Theme) {
    if (preferences) setPreferences(await setTheme(preferences.id, theme))
  }

  async function chooseWeekStart(weekStart: number) {
    if (preferences) setPreferences(await setWeekStart(preferences.id, weekStart))
  }

  return <ThemeContext.Provider value={{ preferences, error, refresh, chooseTheme, chooseWeekStart }}>{children}</ThemeContext.Provider>
}
