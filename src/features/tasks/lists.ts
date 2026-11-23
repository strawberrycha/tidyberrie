import { isOpen, occurrenceValue, taskValue } from './model'
import type { TaskGroup, TaskRow } from './model'
import { addDays, expandDates, localDate, nextOccurrence } from './recurrence'

export const smartLists = ['Today', 'Upcoming', 'Overdue', 'Pinned', 'Completed', 'All'] as const
export type SmartList = typeof smartLists[number]

export function smartRows(groups: TaskGroup[], list: SmartList, now = new Date(), overduePage = 0): TaskRow[] {
  const today = localDate(now)
  const time = [now.getHours(), now.getMinutes()].map(unit => String(unit).padStart(2, '0')).join(':')
  const from = list === 'Upcoming' ? addDays(today, 1) : list === 'Overdue' ? addDays(today, -29 - overduePage * 30) : today
  const through = list === 'Upcoming' ? addDays(today, 7) : list === 'Overdue' ? addDays(today, -overduePage * 30) : today
  const rows: TaskRow[] = []

  for (const group of groups) {
    const task = group.task
    const base = taskValue(group, today)
    if (list === 'All' || list === 'Pinned') {
      if (list === 'All' || base.pinned) rows.push({ group, value: base })
      continue
    }
    if (!task.repeatRule) {
      if (list === 'Completed' ? base.status === 'done'
        : list === 'Overdue' ? !!task.startAt && overduePage === 0 && overdue(base, today, time)
        : task.startAt && base.startDate >= from && base.startDate <= through && isOpen(base.status)) {
        rows.push({ group, value: base })
      }
      continue
    }
    const exceptions = new Map(group.exceptions.filter(item => !item.deletedAt).map(item => [item.date, item]))
    const candidates = new Set(list === 'Completed'
      ? [...exceptions.values()].filter(item => item.action === 'completed').map(item => item.date)
      : expandDates(task.repeatRule, base.startDate, from, through))
    if (list !== 'Completed') {
      for (const item of exceptions.values()) {
        const date = item.movedTo?.slice(0, 10)
        if (date && date >= from && date <= through) candidates.add(item.date)
      }
    }
    for (const occurrence of candidates) {
      if (exceptions.get(occurrence)?.action === 'skipped') continue
      const value = occurrenceValue(base, occurrence, exceptions.get(occurrence))
      if (list !== 'Completed' && (!isOpen(value.status) || value.startDate < from || value.startDate > through)) continue
      if (list === 'Overdue' && !overdue(value, today, time)) continue
      rows.push({ group, occurrence, value })
    }
  }
  return rows
}

export function overdue(value: TaskRow['value'], today: string, time: string) {
  const dueTime = value.endTime || value.startTime
  return isOpen(value.status) && (value.startDate < today || (
    value.startDate === today && !value.allDay && !!dueTime && dueTime < time
  ))
}

export function overdueCount(groups: TaskGroup[], now: Date) {
  return smartRows(groups, 'Overdue', now).filter(row => !row.value.optional).length
}

export function actionDate(row: TaskRow, now = new Date()) {
  if (row.occurrence || !row.group.task.repeatRule) return row.occurrence
  const today = localDate(now)
  const start = row.value.startDate
  const exceptions = row.group.exceptions.filter(item => !item.deletedAt)
  const excluded = new Set(exceptions.filter(item => item.action !== 'moved' || item.movedTo).map(item => item.date))
  const next = nextOccurrence(row.group.task.repeatRule, start, today, excluded)
  const moved = exceptions.filter(item => item.action === 'moved' && item.movedTo && item.movedTo.slice(0, 10) >= today)
    .sort((a, b) => a.movedTo!.localeCompare(b.movedTo!))[0]
  return moved && (!next || moved.movedTo!.slice(0, 10) <= next) ? moved.date : next
}
