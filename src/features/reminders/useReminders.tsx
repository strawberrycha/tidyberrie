import { useContext, useState } from 'react'
import { reminderView } from './ReminderProvider'
import { useToast } from '../../shared/ui/Toast'
import {
  dismissReminder, markReminderDone, openSystemSettings, reminderPlatform, requestExact, requestNotifications, scheduleTest,
  reminderTaskTarget, setReminderLimit, snoozeReminder,
} from './service'

import type { Reminder } from './window'

export function useReminders() {
  const view = useContext(reminderView)
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
    ...view, busy, platform: reminderPlatform, taskTarget: reminderTaskTarget,
    notifications: () => perform(requestNotifications),
    exact: () => perform(requestExact),
    settings: () => perform(openSystemSettings),
    test: (seconds: number) => perform(() => scheduleTest(seconds), 'Test reminder queued.'),
    refresh: () => window.dispatchEvent(new Event('tidyberrie-reminder-refresh')),
    reschedule: () => window.dispatchEvent(new Event('tidyberrie-reminder-reschedule')),
    changeLimit: (value: number) => perform(() => setReminderLimit(value), 'Reminder limit saved.'),
    snooze: (item: Reminder, choice: string) => perform(() => snoozeReminder(item, choice), 'Reminder snoozed.'),
    done: (item: Reminder) => perform(async () => markReminderDone(item), 'Marked done.'),
    dismiss: (item: Reminder) => perform(() => dismissReminder(item), 'Reminder dismissed.'),
  }
}
