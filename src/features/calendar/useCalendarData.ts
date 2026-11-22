import { useEffect, useState } from 'react'
import { useTaskGroups } from '../tasks/useTasks'
import type { TaskGroup } from '../tasks/model'
import type { DateWindow } from './dates'
import { summarizeTasks } from './taskWindow'

const emptyGroups: TaskGroup[] = []

export function useCalendarData(window: DateWindow) {
  const state = useTaskGroups(false)
  const groups = state?.groups ?? emptyGroups
  return { groups, days: summarizeTasks(groups, window), loading: !state, error: state?.error }
}

export function useLocalClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    function tick() {
      clearTimeout(timeout)
      const next = new Date()
      setNow(next)
      timeout = setTimeout(tick, 60000 - next.getSeconds() * 1000 - next.getMilliseconds())
    }
    tick()
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearTimeout(timeout)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return now
}
