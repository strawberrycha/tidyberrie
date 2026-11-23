import type { ReminderStatus } from './schedulers'
import { testKey } from './window'
import type { Reminder } from './window'

export function reminderProblem(status?: ReminderStatus, platform?: string, failed?: boolean) {
  if (status?.notifications === 'denied') return 'Reminders are off'
  if (status?.exact === 'denied') return 'Exact alarms are off'
  if ([status?.notifications, status?.exact].includes('error')) return 'Could not check reminders'
  if ([status?.notifications, status?.exact].includes('unknown')) return 'Reminder status is unknown'
  if (platform === 'android' && status?.notifications === 'unavailable') return 'Reminders are unavailable'
  if (failed) return 'Could not schedule reminders'
}

export function missedReminders(due: Reminder[] = []) {
  return due.filter(item => item.key !== testKey)
}
