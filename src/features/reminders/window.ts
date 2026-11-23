import { summarizeTasks } from '../calendar/taskWindow'
import { localDate } from '../tasks/recurrence'
import { offsets } from '../tasks/input'
import type { TaskGroup } from '../tasks/model'

export const minute = 60_000
export const testKey = 'tidyberrie-test'
export const defaultLimit = 256
export const queueLimits = [32, 64, 128, 256] as const
export type Reminder = { key: string; title: string; at: number; sourceAt: number; scheduleName?: string }
export type Disposition = { sourceAt: number; snoozeAt?: number; dismissed?: boolean }

export function reminderWindow(groups: TaskGroup[], from: number, through: number, maximum = defaultLimit): Reminder[] {
  if (from > through || maximum <= 0) return []
  const first = localDate(new Date(from))
  const last = localDate(new Date(through + Math.max(...offsets) * minute))
  const days = summarizeTasks(groups, { from: first, through: last })
  const results = new Map<string, Reminder>()
  for (const day of days.values()) {
    for (const { group, occurrence, value } of day.rows) {
      if (value.status === 'done' || value.status === 'skipped' || (value.scheduleId && !value.alertNotify)) continue
      const prefix = group.task.id + '/' + (occurrence ?? value.startDate)
      function collect(subject: string, title: string, time: string, minutesBefore: number) {
        if (!time || !offsets.some(offset => offset === minutesBefore)) return
        const at = +new Date(value.startDate + 'T' + time + ':00') - minutesBefore * minute
        if (at >= from && at <= through) {
          const key = prefix + '/' + subject + '/' + minutesBefore
          results.set(key, { key, title, at, sourceAt: at, scheduleName: group.schedule?.name })
        }
      }
      for (const offset of value.scheduleId && !value.reminders.length ? [0] : value.reminders) {
        collect('task', value.title, value.allDay ? '09:00' : value.startTime || '09:00', offset)
      }
      for (const subtask of value.subtasks) {
        if (subtask.done || subtask.reminder === undefined) continue
        collect(subtask.id, value.title + ' · ' + subtask.title, subtask.dueTime, subtask.reminder)
      }
    }
  }
  return sorted([...results.values()]).slice(0, maximum)
}

export function sorted(rows: Reminder[]) {
  return rows.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key))
}

export function snoozeTime(now: Date, duration: '10-minutes' | '1-hour' | 'tomorrow') {
  if (duration !== 'tomorrow') return +now + (duration === '10-minutes' ? 10 : 60) * minute
  const date = new Date(now)
  date.setDate(date.getDate() + 1)
  return +date
}

export function applyDispositions(rows: Reminder[], dispositions: ReadonlyMap<string, Disposition>) {
  return rows.flatMap(item => {
    const saved = dispositions.get(item.key)
    if (!saved || saved.sourceAt !== item.sourceAt) return [item]
    if (saved.dismissed) return []
    return [{ ...item, at: saved.snoozeAt ?? item.at }]
  })
}

export function notificationId(key: string) {
  let hash = 2166136261
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0) % 2147483646 + 1
}
