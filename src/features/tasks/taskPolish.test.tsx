import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { emptyTask } from './input'
import { localDate } from './recurrence'
import { storedTask } from './model'
import type { TaskGroup } from './model'
import { defaultCategories } from './categoryData'
import { Tasks } from './Tasks'

const platform = vi.hoisted(() => ({ native: false, bulk: vi.fn(), groups: [] as TaskGroup[], categories: [] as ReturnType<typeof defaultCategories> }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => platform.native } }))
vi.mock('../../shared/theme/ThemeProvider', () => ({ useTheme: () => ({ preferences: { weekStart: 0 } }) }))
vi.mock('./useTasks', () => ({ useTaskGroups: () => ({ groups: platform.groups }), useTaskActions: () => ({ busy: false, bulk: platform.bulk }) }))

vi.mock('./Categories', () => ({ useCategories: () => ({ rows: platform.categories }) }))
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); platform.native = false; platform.bulk.mockReset(); platform.groups = []; platform.categories = [] })
const show = () => render(<MemoryRouter><Tasks /></MemoryRouter>)

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

it('groups and collapses tasks, excludes skipped from counts, and filters by category', () => {
  mockDialogs()
  const [sleep, meals] = defaultCategories()
  platform.categories = [sleep, meals]
  platform.groups = [
    { title: 'Nap', categoryId: sleep.id, status: 'done' },
    { title: 'Late nap', categoryId: sleep.id, status: 'skipped' },
    { title: 'Dinner', categoryId: meals.id, status: 'todo' },
  ].map(({ title, categoryId, status }) => ({
    task: { ...sleep, id: crypto.randomUUID(), ...storedTask({ ...emptyTask('2099-01-01'), title, categoryId,
      status: status as 'done' | 'skipped' | 'todo' }, 0) }, subtasks: [], exceptions: [],
  }))
  show()
  fireEvent.click(screen.getByRole('button', { name: 'All' }))
  fireEvent.click(screen.getByRole('button', { name: 'More task options' }))
  fireEvent.change(screen.getByLabelText('Group'), { target: { value: 'category' } })
  const sleepGroup = screen.getByRole('button', { name: 'Sleep · 1 of 1 done' })
  fireEvent.click(sleepGroup)
  expect(sleepGroup).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('heading', { name: 'Nap' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
  const sheet = within(screen.getByRole('dialog'))
  fireEvent.click(sheet.getByRole('checkbox', { name: 'Meals' }))
  fireEvent.click(sheet.getByRole('button', { name: 'Show results' }))
  expect(screen.getByRole('heading', { name: 'Dinner' })).toBeVisible()
  expect(sleepGroup).not.toBeInTheDocument()
})

it('shows concise empty states with an add action only on appropriate lists', () => {
  show()
  const lists = screen.getByRole('navigation', { name: 'Task lists' })
  for (const [chip, copy, add] of [
    ['Today', 'Nothing due today', true], ['Upcoming', 'Nothing coming up', true],
    ['Overdue', 'No overdue tasks. Nice!', false], ['All', 'No tasks yet', true], ['Done', 'Nothing completed yet', false],
  ] as const) {
    fireEvent.click(within(lists).getByRole('button', { name: chip }))
    expect(screen.getByRole('heading', { name: copy })).toBeVisible()
    expect(Boolean(screen.queryByRole('button', { name: 'Add a task' }))).toBe(add)
  }
})
