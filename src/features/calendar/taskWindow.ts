import { occurrenceValue, taskValue } from '../tasks/model'
import type { TaskGroup, TaskRow } from '../tasks/model'
import { expandDates, scheduleDates } from '../tasks/recurrence'
import type { DateWindow } from './dates'

export type DaySummary = { rows: TaskRow[]; done: number; colors: TaskRow['value']['color'][] }
export const emptyDay: DaySummary = { rows: [], done: 0, colors: [] }
const cache = new WeakMap<TaskGroup[], Map<string, Map<string, DaySummary>>>()

export function summarizeTasks(groups: TaskGroup[], { from, through }: DateWindow) {
  let windows = cache.get(groups)
  if (!windows) {
    windows = new Map()
    cache.set(groups, windows)
  }
  const key = from + '/' + through
  const previous = windows.get(key)
  if (previous) return previous

  const days = new Map<string, DaySummary>()
  function add(row: TaskRow) {
    const date = row.value.startDate
    if (date < from || date > through) return
    const day = days.get(date) ?? { rows: [], done: 0, colors: [] }
    day.rows.push(row)
    if (row.value.status === 'done') day.done++
    if (day.colors.length < 3) day.colors.push(row.value.color)
    days.set(date, day)
  }

  for (const group of groups) {
    if (group.task.deletedAt || !group.task.startAt) continue
    const base = taskValue(group, from)
    if (group.task.scheduleId && (!group.schedule || group.schedule.paused || group.schedule.deletedAt)) continue
    if (!group.task.repeatRule && !group.task.scheduleId) {
      add({ group, value: base })
      continue
    }
    const exceptions = new Map(group.exceptions.filter(item => !item.deletedAt).map(item => [item.date, item]))
    const occurrences = new Set(group.schedule ? scheduleDates(group.schedule, from, through)
      : group.task.repeatRule ? expandDates(group.task.repeatRule, base.startDate, from, through) : [])
    for (const item of exceptions.values()) {
      const target = item.movedTo?.slice(0, 10)
      if (target && (!group.schedule || scheduleDates(group.schedule, item.date, item.date).length > 0) && target >= from && target <= through) occurrences.add(item.date)
    }
    for (const occurrence of occurrences) {
      const exception = exceptions.get(occurrence)
      if (exception?.action === 'skipped') continue
      add({ group, occurrence, value: occurrenceValue(base, occurrence, exception) })
    }
  }
  for (const day of days.values()) day.rows.sort((a, b) =>
    a.value.startTime.localeCompare(b.value.startTime) || a.value.title.localeCompare(b.value.title))
  if (windows.size >= 12) windows.delete(windows.keys().next().value!)
  windows.set(key, days)
  return days
}

export function summaryText(day: DaySummary) {
  return day.rows.length + (day.rows.length === 1 ? ' task, ' : ' tasks, ') + day.done + ' done'
}
