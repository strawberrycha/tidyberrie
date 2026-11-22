import { smartRows } from '../tasks/lists'
import type { TaskGroup, TaskRow } from '../tasks/model'
import { localTime } from '../calendar/dates'

export function dashboardSummary(rows: TaskRow[], groups: TaskGroup[], now: Date) {
  const done = rows.filter(row => row.value.status === 'done').length
  const overdue = smartRows(groups, 'Overdue', now).length
  const pending = rows.filter(row => row.value.status !== 'done')
  const next = pending.find(row => !row.value.allDay && row.value.startTime >= localTime(now))
    ?? pending.find(row => row.value.allDay || !row.value.startTime)
  const mood = overdue ? 'overdue' : rows.length && done === rows.length ? 'all' : done ? 'some' : 'none'
  return { done, overdue, next, mood } as const
}
