import { useEffect, useState } from 'react'
import type { Records } from '../../shared/db/schemas'
import { watchSchedules } from './scheduleService'

export type Schedule = Records['schedules']
export function useSchedules(deleted = false) {
  const [rows, setRows] = useState<Schedule[]>([])
  const [error, setError] = useState(false)
  useEffect(() => watchSchedules(setRows, () => setError(true), deleted), [deleted])
  return { rows, error }
}

export function dayLabel(days: number[]) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  if (days.length === 7) return 'Every day'
  if (days.length === 5 && [1, 2, 3, 4, 5].every(day => days.includes(day))) return 'Mon–Fri'
  return [1, 2, 3, 4, 5, 6, 0].filter(day => days.includes(day)).map(day => names[day]).join(', ')
}
