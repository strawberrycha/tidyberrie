import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { ReminderInbox } from './ReminderInbox'
import type { TaskGroup } from '../tasks/model'
import { storedTask } from '../tasks/model'
import { emptyTask } from '../tasks/input'
import { Reminders } from './Reminders'

const fixture = vi.hoisted(() => ({
  date: new Date(2028, 1, 27, 8),
  done: vi.fn(), snooze: vi.fn(),
  missed: { key: 'task', title: 'Brush teeth', at: 1803700000000, sourceAt: 1803700000000, scheduleName: 'School' },
  empty: false,
  groups: [] as TaskGroup[],
}))
vi.mock('../../app/useMinuteClock', () => ({ useMinuteClock: () => fixture.date }))
vi.mock('../../shared/theme/ThemeProvider', () => ({ useTheme: () => ({ preferences: { timeFormat: '24h' } }) }))
vi.mock('../../shared/ui/Toast', () => ({ useToast: () => vi.fn() }))
vi.mock('../tasks/useTasks', () => ({ useTaskActions: () => ({ busy: false }), useTaskGroups: () => ({ groups: fixture.groups }) }))
vi.mock('./useReminders', () => ({
  useReminders: () => ({
    status: { notifications: 'granted', exact: 'granted' }, limit: 256, platform: 'web',
    cappedThrough: +fixture.date + 100000,
    due: fixture.empty ? [] : [fixture.missed],
    pending: fixture.empty ? [] : [
      { key: 'near', title: 'Pack bag', at: +fixture.date + 60000, scheduleName: 'School' },
      { key: 'far', title: 'Later', at: +fixture.date + 25 * 60 * 60 * 1000 },
    ],
    done: fixture.done, snooze: fixture.snooze, taskTarget: () => ({ id: 'task' }),
  }),
}))
afterEach(() => { cleanup(); fixture.empty = false; fixture.groups = []; vi.clearAllMocks() })

it('shows missed reminder details and calls existing Done and Snooze actions', () => {
  render(<MemoryRouter><ReminderInbox /></MemoryRouter>)
  expect(screen.getByRole('tabpanel', { name: 'Missed' })).toBeVisible()
  expect(screen.getByRole('tabpanel', { name: 'Missed' })).toHaveTextContent('School')
  fireEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(fixture.done).toHaveBeenCalledWith(fixture.missed)
  fireEvent.click(screen.getByText('Snooze'))
  fireEvent.click(screen.getByRole('button', { name: '10 minutes' }))
  expect(fixture.snooze).toHaveBeenCalledWith(fixture.missed, '10-minutes')
})

it('opens the linked task details', () => {
  const original = Object.getOwnPropertyDescriptors(HTMLDialogElement.prototype)
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
  })
  fixture.groups = [{
    task: { id: 'task', createdAt: '', updatedAt: '', deletedAt: null,
      ...storedTask({ ...emptyTask('2028-02-27'), title: 'Brush teeth' }, 0) },
    subtasks: [], exceptions: [],
  }]
  try {
    render(<MemoryRouter><ReminderInbox /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('dialog', { name: 'Task details' })).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Brush teeth')
  } finally {
    cleanup()
    for (const method of ['showModal', 'close']) {
      if (original[method]) Object.defineProperty(HTMLDialogElement.prototype, method, original[method])
      else Reflect.deleteProperty(HTMLDialogElement.prototype, method)
    }
  }
})

it('uses the native pending list for the next 24 hours and shows the cap note', () => {
  render(<MemoryRouter><ReminderInbox /></MemoryRouter>)
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Missed' }), { key: 'ArrowRight' })
  expect(screen.getByRole('tab', { name: 'Upcoming' })).toHaveFocus()
  expect(screen.getByRole('tabpanel', { name: 'Upcoming' })).toHaveTextContent('Pack bag · School')
  expect(screen.queryByText(/Later/)).not.toBeInTheDocument()
  expect(screen.getByText(/Open the app to extend/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'Reminder settings' })).toHaveAttribute('href', '/more/reminders')
})

it('shows empty states and keeps the settings page free of a duplicate inbox', () => {
  fixture.empty = true
  const { unmount } = render(<MemoryRouter><ReminderInbox /></MemoryRouter>)
  expect(screen.getByText('You’re all caught up')).toBeVisible()
  fireEvent.click(screen.getByRole('tab', { name: 'Upcoming' }))
  expect(screen.getByText('No reminders in the next 24 hours')).toBeVisible()
  unmount()
  fixture.empty = false
  render(<MemoryRouter><Reminders /></MemoryRouter>)
  expect(screen.queryByText('Brush teeth')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open reminders inbox' })).toHaveAttribute('href', '/reminders')
})
