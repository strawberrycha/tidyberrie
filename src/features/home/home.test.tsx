import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { Home } from '../dayTheme/Home'
import { dailyQuote, greeting, openPlan, relativeTime } from './model'
import { emptyTask } from '../tasks/input'
import type { TaskInput } from '../tasks/input'
import { storedTask } from '../tasks/model'
import type { TaskGroup, TaskRow } from '../tasks/model'
import { visibleWindow } from '../calendar/dates'
import { summarizeTasks } from '../calendar/taskWindow'

const fixture = vi.hoisted(() => ({
  flags: { home: true, tasks: true, calendar: false, budget: false, dayTheme: false },
  rows: [] as TaskRow[],
  check: vi.fn(),
  now: new Date(2026, 10, 22, 8, 50),
}))
vi.mock('../../app/features', () => ({ features: fixture.flags }))
vi.mock('../../app/useMinuteClock', () => ({ useMinuteClock: () => fixture.now }))
vi.mock('../../shared/theme/ThemeProvider', () => ({ useTheme: () => ({ preferences: { yourName: 'Cha', weekStart: 1 } }) }))
vi.mock('../reminders/useReminders', () => ({ useReminders: () => ({ status: { notifications: 'denied' } }) }))
vi.mock('../tasks/useTasks', () => ({ useTaskActions: () => ({ check: fixture.check, busy: false }) }))
vi.mock('../calendar/useCalendarData', () => ({ useCalendarData: () => ({
  groups: [], days: new Map([['2026-11-22', {
    rows: fixture.rows, done: fixture.rows.filter(row => row.value.status === 'done').length, colors: ['rose'],
  }]]),
}) }))
vi.mock('../calendar/PlannerTasks', () => ({
  PlannerAddButton: ({ open, label }: { open: () => void; label: string }) => <button onClick={open}>{label}</button>,
  QuickAdd: ({ draft }: { draft: { date: string } }) => <p>Task form for {draft.date}</p>,
}))
vi.mock('../budget/useBudget', () => ({ useBudget: () => ({
  data: { preferences: { budgetConfigured: true, budgetView: 'monthly' }, expenses: [], accounts: [], incomes: [], transfers: [] },
}) }))

function row(title: string, patch: Partial<TaskInput> = {}): TaskRow {
  const value = { ...emptyTask('2026-11-22'), title, ...patch }
  const group: TaskGroup = {
    task: { ...storedTask(value, 1), id: crypto.randomUUID(), createdAt: '2026-11-22T00:00:00Z',
      updatedAt: '2026-11-22T00:00:00Z', deletedAt: null },
    subtasks: [], exceptions: [],
  }
  return { value, group }
}

afterEach(() => { cleanup(); fixture.flags.budget = false; fixture.rows = []; localStorage.clear(); fixture.check.mockClear() })
const renderHome = (overdue = 0) => render(<MemoryRouter><Home overdue={overdue} /></MemoryRouter>)

it('keeps a quote stable for a date, uses local greeting ranges, and reports relative time', () => {
  expect(greeting(11)).toBe('Good morning')
  expect(greeting(12)).toBe('Good afternoon')
  expect(greeting(18)).toBe('Good evening')
  expect(dailyQuote('2026-12-31')).toBe(dailyQuote('2026-12-31'))
  expect(dailyQuote('2026-12-31')).not.toBe(dailyQuote('2027-01-01'))
  expect(relativeTime('11:00', fixture.now)).toBe('in 2h 10m')
})

it('orders progress before time and excludes completed tasks', () => {
  const rows = [row('Untimed'), row('Soon', { startTime: '09:00', allDay: false }), row('Done', { status: 'done' }), row('In progress', { status: 'doing' })]
  expect(openPlan(rows).map(task => task.value.title)).toEqual(['In progress', 'Soon', 'Untimed'])
})

it('reuses week boundaries and counts recurring dots after applying exceptions', () => {
  expect(visibleWindow('Week', '2024-02-29', 0)).toEqual({ from: '2024-02-25', through: '2024-03-02' })
  expect(visibleWindow('Week', '2026-12-31', 1)).toEqual({ from: '2026-12-28', through: '2027-01-03' })
  const repeated = row('Repeated', { repeat: { ...emptyTask('2026-11-22').repeat, mode: 'daily' } }).group
  repeated.exceptions.push({ ...repeated.task, taskId: repeated.task.id, date: '2026-11-23', action: 'skipped', movedTo: null, subtaskStates: {} })
  const days = summarizeTasks([repeated], visibleWindow('Week', '2026-11-23', 1))
  expect(days.get('2026-11-23')).toBeUndefined()
  expect(days.get('2026-11-24')?.colors).toHaveLength(1)
})

it('renders the short plan, progress, reminder health, and the overdue and Show more links', () => {
  fixture.rows = [row('First', { startTime: '11:00', allDay: false }), row('Two'), row('Three'), row('Four'), row('Done', { status: 'done' })]
  renderHome(2)
  expect(screen.getByText('Next up · in 2h 10m')).toBeVisible()
  expect(screen.getByText('1 of 5 done')).toBeVisible()
  expect(screen.getByRole('link', { name: '2 overdue' })).toHaveAttribute('href', '/tasks?list=Overdue')
  expect(screen.getByRole('link', { name: 'Show 1 more' })).toHaveAttribute('href', '/tasks?list=Today')
  expect(screen.getByRole('link', { name: /Reminders are off/ })).toHaveAttribute('href', '/more/reminders')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Complete First' }))
  expect(fixture.check).toHaveBeenCalledWith(fixture.rows[0].group.task.id, undefined, true)
})

it('shows empty and completed states and uses one tap to open the task form', () => {
  const view = renderHome()
  expect(screen.getByText('Nothing planned today')).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'Budget' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
  expect(screen.getByText('Task form for 2026-11-22')).toBeVisible()
  view.unmount()
  fixture.rows = [row('Finished', { status: 'done' })]
  renderHome()
  expect(screen.getByText('All done! Enjoy your day')).toBeVisible()
})

it('shows Budget only with the flag on and persists the amount mask', () => {
  fixture.flags.budget = true
  const view = renderHome()
  expect(screen.getByRole('heading', { name: 'Budget' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }))
  expect(screen.getAllByText('₱ ••••')).toHaveLength(2)
  view.unmount()
  renderHome()
  expect(screen.getByRole('button', { name: 'Show amounts' })).toBeVisible()
})
