import { createContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { ReminderState } from './service'

const initial: ReminderState = { due: [], limit: 64 }
export const reminderView = createContext(initial)

export function ReminderProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState(initial)
  useEffect(() => {
    let active = true
    let stop: (() => void) | undefined
    const timer = window.setTimeout(() => {
      void import('./service').then(({ startReminders }) => {
        if (active) stop = startReminders(setView)
      }, () => {
        if (active) setView({ ...initial, error: true })
      })
    }, 350)
    return () => {
      active = false
      window.clearTimeout(timer)
      stop?.()
    }
  }, [])
  return <reminderView.Provider value={view}>{children}</reminderView.Provider>
}
