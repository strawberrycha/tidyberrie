import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useToast } from '../../shared/ui/Toast'
import {
  dismissReminder, openSystemSettings, reminderPlatform, requestExact, requestNotifications, scheduleTest,
  setReminderLimit, snoozeReminder, startReminders,
} from './service'
import type { ReminderState } from './service'
import type { Reminder } from './window'

const state = createContext<ReminderState>({ due: [], limit: 64 })

export function ReminderProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ReminderState>({ due: [], limit: 64 })
  useEffect(() => startReminders(setView), [])
  return <state.Provider value={view}>{children}</state.Provider>
}

export function useReminders() {
  const view = useContext(state)
  const show = useToast()
  const [busy, setBusy] = useState(false)

  async function perform(action: () => Promise<void | (() => Promise<void>)>, message?: string) {
    if (busy) return
    setBusy(true)
    try {
      const undo = await action()
      if (message) show({ message, action: undo ? { label: 'Undo', run: undo } : undefined })
      window.dispatchEvent(new Event('tidyberrie-reminder-refresh'))
    } catch {
      show({ message: 'Could not update reminders. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  return {
    ...view, busy, platform: reminderPlatform,
    notifications: () => perform(requestNotifications),
    exact: () => perform(requestExact),
    settings: () => perform(openSystemSettings),
    test: () => perform(scheduleTest, 'Test reminder set for one minute from now.'),
    changeLimit: (value: number) => perform(() => setReminderLimit(value), 'Reminder limit saved.'),
    snooze: (item: Reminder, choice: string) => perform(() => snoozeReminder(item, choice), 'Reminder snoozed.'),
    dismiss: (item: Reminder) => perform(() => dismissReminder(item), 'Reminder dismissed.'),
  }
}
