import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { emptyTask } from '../tasks/input'
import { storedTask } from '../tasks/model'
import type { TaskGroup } from '../tasks/model'
import { defaultRepeat } from '../tasks/recurrence'
import { dashboardSummary } from '../dayTheme/dashboard'
import { localDate, shiftMonth, stepView, visibleWindow, windowDates } from './dates'
import { MonthGrid } from './MonthGrid'
import { summarizeTasks } from './taskWindow'
import { useLocalClock } from './useCalendarData'

const stamp = () => ({ id: crypto.randomUUID(), createdAt: '2026-11-22T00:00:00Z', updatedAt: '2026-11-22T00:00:00Z', deletedAt: null })
afterEach(() => { cleanup(); vi.useRealTimers() })

it('uses five or six rows, includes leap day, and honors week start', () => {
  const feb = visibleWindow('Month', '2024-02-29', 1)
  expect(feb).toEqual({ from: '2024-01-29', through: '2024-03-03' })
  expect(windowDates(feb)).toHaveLength(35)
  expect(windowDates(feb)).toContain('2024-02-29')
  expect(windowDates(visibleWindow('Month', '2026-08-01', 1))).toHaveLength(42)
  expect(visibleWindow('Week', '2026-11-22', 0)).toEqual({ from: '2026-11-22', through: '2026-11-28' })
  expect(visibleWindow('Week', '2026-11-22', 1)).toEqual({ from: '2026-11-16', through: '2026-11-22' })
})

it('steps across December and clamps dates at the destination month end', () => {
  expect(stepView('Month', '2026-12-31', 1)).toBe('2027-01-31')
  expect(shiftMonth('2024-01-31', 1)).toBe('2024-02-29')
  expect(shiftMonth('2025-03-31', -1)).toBe('2025-02-28')
  expect(stepView('Day', '2026-12-31', 1)).toBe('2027-01-01')
  expect(visibleWindow('Month', '2026-12-31', 1).through).toBe('2027-01-03')
})

it('rolls across midnight and catches up immediately on foregrounding', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 55))
  function Clock() { return <output>{localDate(useLocalClock())}</output> }
  render(<Clock />)
  expect(screen.getByRole('status')).toHaveTextContent('2026-12-31')
  act(() => vi.advanceTimersByTime(5000))
  expect(screen.getByRole('status')).toHaveTextContent('2027-01-01')
  vi.setSystemTime(new Date(2027, 0, 3, 10))
  fireEvent(document, new Event('visibilitychange'))
  expect(screen.getByRole('status')).toHaveTextContent('2027-01-03')
})

it('counts completed, moved, and skipped occurrences and invalidates on changed data', () => {
  const task = { ...stamp(), ...storedTask({
    ...emptyTask('2026-11-20'), title: 'Repeat', repeat: { ...defaultRepeat, mode: 'daily' },
  }, 1) }
  const exception = { ...stamp(), taskId: task.id, movedTo: null, subtaskStates: {} }
  const group: TaskGroup = { task, subtasks: [], exceptions: [
    { ...exception, date: '2026-11-22', action: 'completed' },
    { ...exception, id: crypto.randomUUID(), date: '2026-11-23', action: 'skipped' },
    { ...exception, id: crypto.randomUUID(), date: '2026-11-21', action: 'moved', movedTo: '2026-11-24' },
  ] }
  const groups = [group]
  const window = { from: '2026-11-22', through: '2026-11-24' }
  const days = summarizeTasks(groups, window)
  expect(days.get('2026-11-22')).toMatchObject({ done: 1, rows: [{ occurrence: '2026-11-22' }] })
  expect(days.has('2026-11-23')).toBe(false)
  expect(days.get('2026-11-24')?.rows).toHaveLength(2)
  expect(summarizeTasks(groups, { ...window })).toBe(days)
  expect(summarizeTasks([{ ...group, exceptions: [] }], window).get('2026-11-22')?.done).toBe(0)

  const now = new Date(2026, 10, 22, 15)
  const timed = { ...stamp(), ...storedTask({
    ...emptyTask('2026-11-22'), title: 'Next', allDay: false, startTime: '16:30',
  }, 1) }
  const all = [...groups, { task: timed, subtasks: [], exceptions: [] }]
  const today = summarizeTasks(all, { from: '2026-11-22', through: '2026-11-22' })
  const dashboard = dashboardSummary(today.get('2026-11-22')!.rows, all, now)
  expect(dashboard.done).toBe(1)
  expect(dashboard.next?.value.title).toBe('Next')
  expect(dashboard.overdue).toBe(1)
})

it('moves focus with arrows across a week boundary and activates the focused date', () => {
  const open = vi.fn()
  function Grid() {
    const [anchor, move] = useState('2026-12-31')
    return <MonthGrid window={visibleWindow('Week', anchor, 1)} anchor={anchor} today="2026-12-31"
      days={new Map()} themeFor={() => undefined} move={move} open={open} week />
  }
  render(<Grid />)
  const anchor = screen.getByRole('button', { name: /^31\s*0 tasks, 0 done/ })
  anchor.focus()
  fireEvent.keyDown(anchor, { key: 'ArrowDown' })
  const moved = screen.getByRole('button', { name: /^7\s*0 tasks, 0 done/ })
  expect(moved).toHaveFocus()
  expect(moved).toHaveAttribute('tabindex', '0')
  fireEvent.click(moved)
  expect(open).toHaveBeenCalledWith('2027-01-07')
})
