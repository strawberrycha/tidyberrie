import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../shared/ui/Toast'
import { Tasks } from './Tasks'
import { emptyTask } from './input'
import { storedTask } from './model'
import { localDate } from './recurrence'
import { metadata } from '../../shared/db/repository'
import type { Category } from './useHierarchy'
import type { TaskGroup } from './model'

const state = vi.hoisted(() => ({ categories: [] as Category[], tasks: [] as TaskGroup[], save: vi.fn(), remove: vi.fn() }))
vi.mock('./useHierarchy', () => ({ useHierarchy: () => ({ categories: state.categories, groups: [] }) }))
vi.mock('./useTasks', () => ({
  useTaskGroups: () => ({ groups: state.tasks }),
  useTaskActions: () => ({ busy: false, save: state.save, remove: state.remove }),
}))
vi.mock('../../shared/theme/ThemeProvider', () => ({ useTheme: () => ({ preferences: { weekStart: 1 } }) }))
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); state.categories = []; state.tasks = [] })

const study: Category = { ...metadata(), name: 'Study', icon: 'book', color: 'mint', order: 0, groupId: null, archived: false }
function item(title: string, categoryId: string | null, repeat = false): TaskGroup {
  const date = localDate()
  const value = emptyTask(date)
  return { task: { ...metadata(), ...storedTask({ ...value, title, categoryId,
    repeat: { ...value.repeat, mode: repeat ? 'daily' : 'once' } }, 1) }, subtasks: [], exceptions: [] }
}

function page(path = '/tasks') {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
  })
  render(<MemoryRouter initialEntries={[path]}><ToastProvider><Tasks /></ToastProvider></MemoryRouter>)
}

it('adds into the selected category and keeps the main add action Uncategorized', () => {
  state.categories = [study]
  page()
  expect(screen.getByRole('button', { name: 'Categories' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: /^Study.*open/ }))
  expect(screen.getByRole('heading', { name: 'Study' })).toBeVisible()
  fireEvent.click(screen.getAllByRole('button', { name: 'Add task' })[0])
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Read' } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'All day' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save task' }))
  expect(state.save).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: study.id }), 1, undefined, undefined, expect.any(Function))
  cleanup()
  page()
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Add' })).getByRole('button', { name: 'Add a task' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Walk' } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'All day' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save task' }))
  expect(state.save).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: null }), 1, undefined, undefined, expect.any(Function))
})

it('filters category rows and offers occurrence and whole-series deletion through task actions', () => {
  state.categories = [study]
  const repeated = item('Review', study.id, true)
  state.tasks = [repeated, item('Walk', null)]
  page('/tasks?list=Today')
  expect(screen.getByRole('button', { name: /^Study ·/ })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
  const filter = within(screen.getByRole('dialog', { name: 'Filter tasks' }))
  fireEvent.click(filter.getByRole('checkbox', { name: 'Study' }))
  fireEvent.click(filter.getByRole('button', { name: 'Show results' }))
  expect(screen.queryByRole('heading', { name: 'Walk' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'More task options' }))
  fireEvent.change(screen.getByLabelText('View'), { target: { value: 'time' } })
  expect(screen.queryByRole('button', { name: /^Study ·/ })).not.toBeInTheDocument()
  fireEvent.contextMenu(screen.getByRole('button', { name: 'Review' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(state.remove).toHaveBeenLastCalledWith(repeated.task.id, localDate(), expect.any(Function))
  fireEvent.click(screen.getByRole('button', { name: 'Delete all' }))
  expect(state.remove).toHaveBeenLastCalledWith(repeated.task.id, undefined, expect.any(Function))
})
