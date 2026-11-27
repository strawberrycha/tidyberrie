import { monthFirstDate } from '../../shared/utils/dateFormat'
import { addDays, localDate } from '../tasks/recurrence'

export const calendarViews = ['Month', 'Week', 'Day', 'Agenda'] as const
export type CalendarView = typeof calendarViews[number]
export type DateWindow = { from: string; through: string }

const date = (key: string) => new Date(key + 'T12:00:00Z')
export const weekdayOf = (key: string) => date(key).getUTCDay()

export function dateLabel(key: string, options: Intl.DateTimeFormatOptions = {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}) {
  return monthFirstDate(key, options)
}

export function weekFirst(key: string, weekStart: number) {
  return addDays(key, -((weekdayOf(key) - weekStart + 7) % 7))
}

export function shiftMonth(key: string, amount: number) {
  const value = date(key)
  const requested = value.getUTCDate()
  value.setUTCDate(1)
  value.setUTCMonth(value.getUTCMonth() + amount + 1, 0)
  value.setUTCDate(Math.min(requested, value.getUTCDate()))
  return value.toISOString().slice(0, 10)
}

export function visibleWindow(view: CalendarView, anchor: string, weekStart: number): DateWindow {
  if (view === 'Day') return { from: anchor, through: anchor }
  if (view === 'Agenda') return { from: anchor, through: addDays(anchor, 13) }
  if (view === 'Week') {
    const from = weekFirst(anchor, weekStart)
    return { from, through: addDays(from, 6) }
  }
  const first = anchor.slice(0, 7) + '-01'
  const last = addDays(shiftMonth(first, 1), -1)
  return { from: weekFirst(first, weekStart), through: addDays(weekFirst(last, weekStart), 6) }
}

export function windowDates({ from, through }: DateWindow) {
  const keys: string[] = []
  for (let key = from; key <= through; key = addDays(key, 1)) keys.push(key)
  return keys
}

export function stepView(view: CalendarView, anchor: string, direction: number) {
  return view === 'Month' ? shiftMonth(anchor, direction)
    : addDays(anchor, direction * (view === 'Week' ? 7 : view === 'Agenda' ? 14 : 1))
}

export function localTime(now: Date) {
  return [now.getHours(), now.getMinutes()].map(part => String(part).padStart(2, '0')).join(':')
}

export { localDate }
