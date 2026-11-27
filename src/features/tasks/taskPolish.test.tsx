import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { emptyTask } from './input'
import { localDate } from './recurrence'
import { storedTask } from './model'
import type { TaskGroup } from './model'
import { defaultCategories } from './categoryData'
import { ToastProvider } from '../../shared/ui/Toast'
import type { Schedule } from './useSchedules'
import { dayLabel } from './useSchedules'
import { Tasks } from './Tasks'
import { ScheduleDays, Schedules } from './Schedules'

const platform = vi.hoisted(() => ({ native: false, bulk: vi.fn(), groups: [] as TaskGroup[], schedules: [] as Schedule[] }))
vi.mock('../../app/features', async load => ({ features: { ...(await load<typeof import('../../app/features')>()).features, schedules: true } }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => platform.native } }))
vi.mock('../../shared/theme/ThemeProvider', () => ({ useTheme: () => ({ preferences: { weekStart: 0 } }) }))
vi.mock('./useTasks', () => ({ useTaskGroups: () => ({ groups: platform.groups }), useTaskActions: () => ({ busy: false, bulk: platform.bulk }) }))

vi.mock('./useSchedules', async importOriginal => ({ ...await importOriginal<typeof import('./useSchedules')>(), useSchedules: () => ({ rows: platform.schedules }) }))
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); platform.native = false; platform.bulk.mockReset(); platform.groups = []; platform.schedules = []; localStorage.clear() })
const show = () => render(<MemoryRouter><ToastProvider><Tasks /></ToastProvider></MemoryRouter>)

it('excludes the seed button in production and in a native development build', () => {
  vi.stubEnv('DEV', false)
  const production = show()
  expect(screen.queryByRole('button', { name: /seed/ })).not.toBeInTheDocument()
  production.unmount()
  vi.stubEnv('DEV', true)
  platform.native = true
  show()
  expect(screen.queryByRole('button', { name: /seed/ })).not.toBeInTheDocument()
})

function mockDialogs() {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
  })
}

it('selects cards from their menu, announces the count, and exits on Back or leaving Tasks', () => {
  mockDialogs()
  platform.groups = ['Read', 'Walk'].map(title => ({
    task: { ...defaultCategories()[0], id: crypto.randomUUID(), ...storedTask({ ...emptyTask(localDate()), title }, 0) },
    subtasks: [], exceptions: [],
  }))
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Read' }))
  fireEvent.click(screen.getByRole('button', { name: 'Select' }))
  expect(screen.getByRole('heading', { name: '1 selected' })).toBeVisible()
  expect(screen.getByRole('checkbox', { name: 'Select Read' })).toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
  expect(screen.getByText('2 selected', { selector: '[aria-live]' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Walk' }))
  expect(screen.getByRole('heading', { name: '1 selected' })).toBeVisible()
  const event = new Event('tidyberrie-back', { cancelable: true })
  fireEvent(document, event)
  expect(event.defaultPrevented).toBe(true)
  expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Read' }))
  fireEvent.click(screen.getByRole('button', { name: 'Select' }))
  fireEvent(window, new Event('tidyberrie-task-tab-leave'))
  expect(screen.queryByRole('grid')).not.toBeInTheDocument()
})

it('enters selection after a held touch and ignores gestures near the screen edge', () => {
  vi.useFakeTimers()
  platform.groups = [{
    task: { ...defaultCategories()[0], ...storedTask({ ...emptyTask(localDate()), title: 'Touch card' }, 0) },
    exceptions: [], subtasks: [],
  }]
  show()
  const card = screen.getByRole('heading', { name: 'Touch card' })
  const press = (clientX: number) => fireEvent(card, Object.assign(new Event('pointerdown', { bubbles: true }), {
    pointerType: 'touch', pointerId: 1, button: 0, clientX, clientY: 100,
  }))
  press(6)
  act(() => vi.advanceTimersByTime(410))
  expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  press(120)
  act(() => vi.advanceTimersByTime(390))
  expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(20))
  expect(screen.getByRole('heading', { name: '1 selected' })).toBeVisible()
})

it('offers one repeating deletion choice and keeps optional tasks out of Move all', () => {
  mockDialogs()
  const date = '2020-01-01'
  const repeating = { ...emptyTask(localDate()), title: 'Repeat', repeat: { ...emptyTask(date).repeat, mode: 'daily' as const } }
  const stamp = defaultCategories()[0]
  platform.groups = [
    { task: { ...stamp, ...storedTask(repeating, 0) }, exceptions: [], subtasks: [] },
    ...['Required', 'Extra'].map(title => ({
      task: { ...stamp, id: crypto.randomUUID(), ...storedTask({ ...emptyTask(date), title, optional: title === 'Extra' }, 0) },
      exceptions: [], subtasks: [],
    })),
  ]
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Repeat' }))
  fireEvent.click(screen.getByRole('button', { name: 'Select' }))
  const actions = within(screen.getByRole('group', { name: 'Selected task actions' }))
  fireEvent.click(actions.getByRole('button', { name: 'Delete' }))
  fireEvent.click(screen.getByRole('button', { name: 'This occurrence only' }))
  expect(platform.bulk).toHaveBeenCalledWith([{ id: stamp.id, occurrence: localDate() }], { kind: 'delete', scope: 'occurrence' }, expect.any(Function))
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
  fireEvent.click(screen.getByRole('button', { name: 'Exit selection' }))
  fireEvent.click(screen.getByRole('button', { name: /^Overdue/ }))
  expect(screen.queryByRole('heading', { name: 'Extra' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Optional · 1/ }))
  expect(screen.getByRole('heading', { name: 'Extra' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Move all to today' }))
  fireEvent.click(screen.getByRole('button', { name: 'Move to today' }))
  expect(platform.bulk).toHaveBeenLastCalledWith([{ id: platform.groups[1].task.id, occurrence: undefined }], { kind: 'date', date: localDate() }, expect.any(Function))
})

it('groups and collapses tasks, excludes skipped from counts, and filters by schedule', () => {
  mockDialogs()
  const days = [new Date().getDay()]
  const [sleep, meals] = defaultCategories().slice(0, 2).map((item, index) => ({ ...item, name: index ? 'Meals' : 'Sleep', days, paused: false, startDate: null, endDate: null }))
  platform.schedules = [sleep, meals]
  platform.groups = [
    { title: 'Nap', scheduleId: sleep.id, status: 'done' },
    { title: 'Late nap', scheduleId: sleep.id, status: 'skipped' },
    { title: 'Dinner', scheduleId: meals.id, status: 'todo' },
  ].map(({ title, scheduleId, status }) => {
    const task = { ...sleep, id: crypto.randomUUID(), ...storedTask({ ...emptyTask(localDate()), title, scheduleId, allDay: false, startTime: '07:00',
      status: status as 'done' | 'skipped' | 'todo' }, 0) }
    return { task, schedule: platform.schedules.find(schedule => schedule.id === scheduleId), subtasks: [],
      exceptions: status === 'done' ? [{ ...sleep, taskId: task.id, date: localDate(), action: 'completed' as const, movedTo: null, subtaskStates: {} }] : [] }
  })
  show()
  const sleepGroup = screen.getByRole('button', { name: 'Sleep · ' + dayLabel(days) + ' · 1 of 1 done' })
  fireEvent.click(screen.getByRole('button', { name: 'Add task to Sleep' }))
  expect(screen.getByRole('button', { name: 'Schedule · Sleep' })).toBeVisible()
  expect(screen.queryByLabelText('Date')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Start time')).toBeRequired()
  expect(screen.getByRole('switch', { name: 'Notify' })).toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
  fireEvent.click(sleepGroup)
  expect(sleepGroup).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('heading', { name: 'Nap' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
  const sheet = within(screen.getByRole('dialog'))
  fireEvent.click(sheet.getByRole('checkbox', { name: 'Meals' }))
  fireEvent.click(sheet.getByRole('button', { name: 'Show results' }))
  expect(screen.getByRole('heading', { name: 'Dinner' })).toBeVisible()
  expect(sleepGroup).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'More task options' }))
  fireEvent.change(screen.getByLabelText('View'), { target: { value: 'time' } })
  expect(localStorage.getItem('tidyberrie-task-view')).toBe('time')
  expect(screen.queryByRole('button', { name: 'Add task to Meals' })).not.toBeInTheDocument()
})

it('applies day presets and announces the active day toggle', () => {
  const setDays = vi.fn()
  render(<ScheduleDays days={[1, 3]} setDays={setDays} />)
  expect(screen.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Monday' }))
  expect(setDays).toHaveBeenLastCalledWith([3])
  fireEvent.click(screen.getByRole('button', { name: 'Weekdays' }))
  expect(setDays).toHaveBeenLastCalledWith([1, 2, 3, 4, 5])
  fireEvent.click(screen.getByRole('button', { name: 'Weekends' }))
  expect(setDays).toHaveBeenLastCalledWith([0, 6])
})

it('validates a schedule editor draft and protects unsaved changes', async () => {
  render(<MemoryRouter><ToastProvider><Schedules /></ToastProvider></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Create a schedule' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'School' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose at least one day.')
  fireEvent.click(screen.getByRole('button', { name: 'Weekdays' }))
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  try {
    fireEvent.click(screen.getAllByRole('button', { name: 'Back' })[0])
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?')
    expect(screen.getByLabelText('Name')).toHaveValue('School')
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getAllByRole('button', { name: 'Back' })[0])
    expect(screen.getByRole('button', { name: 'Create a schedule' })).toBeVisible()
  } finally { confirm.mockRestore() }
})

it('shows concise empty states with an add action only on appropriate lists', () => {
  show()
  const lists = screen.getByRole('navigation', { name: 'Task lists' })
  for (const [chip, copy, add] of [
    ['Today', 'Plan your day with a schedule', false], ['Upcoming', 'Nothing coming up', true],
    ['Overdue', 'No overdue tasks. Nice!', false], ['All', 'No tasks yet', true], ['Done', 'Nothing completed yet', false],
  ] as const) {
    fireEvent.click(within(lists).getByRole('button', { name: chip }))
    expect(screen.getByRole('heading', { name: copy })).toBeVisible()
    expect(Boolean(screen.queryByRole('button', { name: 'Add a task' }))).toBe(add)
  }
})
