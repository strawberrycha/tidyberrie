import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { initializeSettings, setTheme } from '../../features/settings/service'
import { applyTheme } from './tokens'
import type { Theme } from './tokens'

type Preferences = Awaited<ReturnType<typeof initializeSettings>>
type ThemeState = {
  preferences?: Preferences
  error: boolean
  refresh: () => Promise<void>
  chooseTheme: (theme: Theme) => Promise<void>
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
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (preferences) applyTheme(preferences.theme)
  }, [preferences])

  async function chooseTheme(theme: Theme) {
    if (preferences) setPreferences(await setTheme(preferences.id, theme))
  }

  return <ThemeContext.Provider value={{ preferences, error, refresh, chooseTheme }}>{children}</ThemeContext.Provider>
}
