import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CategoryDirectory } from './CategoryDirectory'
import { metadata } from '../../shared/db/repository'
import { emptyTask } from './input'
import { storedTask } from './model'
import { ToastProvider } from '../../shared/ui/Toast'

const spy = vi.hoisted(() => ({ save: vi.fn(), delete: vi.fn(), deleteAll: vi.fn(), undo: vi.fn(), group: vi.fn() }))
vi.mock('./categoryService', () => ({ saveCategory: spy.save }))
vi.mock('./hierarchyService', () => ({
  deleteCategory: spy.delete, deleteCategoryAndTasks: spy.deleteAll, saveGroup: spy.group,
}))
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear() })

const group = { ...metadata(), name: 'School', color: 'rose' as const, order: 0 }
const study = { ...metadata(), name: 'Study', color: 'mint' as const, icon: 'book' as const, order: 0, groupId: group.id, archived: false }
const errands = { ...study, ...metadata(), name: 'Errands', groupId: null }
const today = '2026-11-27'
const uncategorized = { task: { ...metadata(), ...storedTask({ ...emptyTask(today), title: 'Read' }, 0) }, subtasks: [], exceptions: [] }

function directory(props: Partial<Parameters<typeof CategoryDirectory>[0]> = {}) {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
  })
  return render(<ToastProvider><CategoryDirectory categories={[study, errands]} groups={[group]} tasks={[uncategorized]}
    today={today} query="" categoryFilter="" openCategory={vi.fn()} addTask={vi.fn()} {...props} /></ToastProvider>)
}

it('renders groups, ungrouped categories, and virtual Uncategorized and remembers collapse', () => {
  const open = vi.fn()
  const first = directory({ openCategory: open })
  expect(screen.getByRole('button', { name: /^School.*1 categories/ })).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(screen.getByRole('button', { name: /^School.*1 categories/ }))
  expect(screen.queryByRole('button', { name: /^Study.*open/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^Errands.*open/ }))
  expect(open).toHaveBeenCalledWith(errands.id)
  expect(screen.getByRole('button', { name: /^Uncategorized.*1 open/ })).toBeVisible()
  first.unmount()
  directory({ tasks: [] })
  expect(screen.getByRole('button', { name: /^School/ })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: /Uncategorized/ })).not.toBeInTheDocument()
})

it('offers both first-run actions and creates a category with only name, color and icon', async () => {
  spy.save.mockResolvedValue(spy.undo)
  const add = vi.fn()
  directory({ categories: [], groups: [], tasks: [], addTask: add })
  expect(screen.getByRole('heading', { name: 'Organize your tasks' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Add a task' }))
  expect(add).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Add' })).getByRole('button', { name: 'Add a category' }))
  const form = within(screen.getByRole('dialog', { name: 'Add category' }))
  expect(form.getByRole('textbox', { name: 'Name' })).toHaveFocus()
  expect(form.getByRole('radiogroup', { name: 'Icon' })).toBeVisible()
  expect(form.queryByText('Active from')).not.toBeInTheDocument()
  fireEvent.change(form.getByRole('textbox', { name: 'Name' }), { target: { value: 'Reading' } })
  fireEvent.click(form.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('button', { name: 'Undo' })).toBeVisible()
  expect(spy.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Reading', color: 'rose' }), undefined)
})

it('offers counted deletion, Undo, and atomic create-group-and-move', async () => {
  spy.deleteAll.mockResolvedValue(spy.undo)
  spy.group.mockResolvedValue(spy.undo)
  directory({ tasks: [{ ...uncategorized, task: { ...uncategorized.task, categoryId: study.id } }] })
  fireEvent.contextMenu(screen.getByRole('button', { name: /^Study.*open/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete all' }))
  expect(screen.getByText('Study will be removed. 1 task will also be deleted.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Delete all' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))
  expect(spy.deleteAll).toHaveBeenCalledWith(study.id)
  expect(spy.undo).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Study' }))
  fireEvent.click(screen.getByRole('button', { name: 'Move to a group' }))
  fireEvent.click(screen.getByRole('button', { name: 'Create a group' }))
  expect(screen.queryByRole('radiogroup', { name: 'Icon' })).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox', { name: 'Group name' }), { target: { value: 'New group' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('button', { name: 'Undo' })).toBeVisible()
  expect(spy.group).toHaveBeenCalledWith({ name: 'New group', color: 'rose' }, undefined, study.id)
})
