import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { emptyTask } from './input'
import { storedTask } from './model'
import type { TaskGroup } from './model'
import { defaultCategories } from './categoryData'
import { Tasks } from './Tasks'

const platform = vi.hoisted(() => ({ native: false, groups: [] as TaskGroup[], categories: [] as ReturnType<typeof defaultCategories> }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => platform.native } }))
vi.mock('../../shared/theme/ThemeProvider', () => ({ useTheme: () => ({ preferences: { weekStart: 0 } }) }))
vi.mock('./useTasks', () => ({ useTaskGroups: () => ({ groups: platform.groups }), useTaskActions: () => ({ busy: false }) }))

vi.mock('./Categories', () => ({ useCategories: () => ({ rows: platform.categories }) }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); platform.native = false; platform.groups = []; platform.categories = [] })
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

it('groups and collapses tasks, excludes skipped from counts, and filters by category', () => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
  })
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
