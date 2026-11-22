import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import { emptyTask, newSubtask } from './input'
import { storedTask } from './model'
import { TaskCard } from './TaskCard'
import { TaskForm } from './TaskForm'

const initial = emptyTask('2026-11-22')

const methods = {
  showModal(this: HTMLDialogElement) { this.setAttribute('open', '') },
  close(this: HTMLDialogElement) { this.removeAttribute('open') },
}
const original = Object.fromEntries(Object.keys(methods).map(name => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]))
beforeAll(() => {
  for (const [name, method] of Object.entries(methods)) {
    Object.defineProperty(HTMLDialogElement.prototype, name, { value: method, configurable: true })
  }
})
afterEach(cleanup)
afterAll(() => {
  for (const [name, descriptor] of Object.entries(original)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
})

it('focuses Title, validates, adds subtasks via Enter, traps Tab and supports Escape', async () => {
  const save = vi.fn()
  const close = vi.fn()
  const confirmDiscard = vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<TaskForm initial={initial} title="Add task" busy={false} save={save} close={close} />)
  const title = screen.getByRole('textbox', { name: 'Title' })
  expect(title).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Save task' }))
  expect(await screen.findByText('Enter a title.')).toBeVisible()
  expect(save).not.toHaveBeenCalled()
  fireEvent.change(title, { target: { value: 'Read' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add subtask' }))
  const first = screen.getByRole('textbox', { name: 'Subtask 1' })
  fireEvent.change(first, { target: { value: 'Pick a book' } })
  fireEvent.keyDown(first, { key: 'Enter' })
  const second = screen.getByRole('textbox', { name: 'Subtask 2' })
  await waitFor(() => expect(second).toHaveFocus())
  fireEvent.change(second, { target: { value: 'Read a chapter' } })
  const submit = screen.getByRole('button', { name: 'Save task' })
  submit.focus()
  fireEvent.keyDown(submit, { key: 'Tab' })
  const closeButton = screen.getByRole('button', { name: 'Close dialog' })
  expect(closeButton).toHaveFocus()
  fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })
  expect(submit).toHaveFocus()
  fireEvent.click(submit)
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Read', subtasks: [
    expect.objectContaining({ title: 'Pick a book' }), expect.objectContaining({ title: 'Read a chapter' }),
  ] }))
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(close).toHaveBeenCalled()
  expect(confirmDiscard).toHaveBeenCalledWith('Discard unsaved changes?')
  confirmDiscard.mockRestore()
})

it('shows textual progress and a priority icon, and checks an expanded subtask', () => {
  const item = { ...newSubtask(), title: 'Outline' }
  const value = { ...initial, title: 'Write', priority: 'high' as const, subtasks: [item] }
  const task = { id: crypto.randomUUID(), createdAt: '', updatedAt: '', deletedAt: null, ...storedTask(value, 1) }
  const check = vi.fn()
  render(<TaskCard row={{ group: { task, subtasks: [], exceptions: [] }, value }} now={new Date(2026, 10, 22)}
    canComplete disabled={false} edit={() => {}} remove={() => {}} check={check} />)
  expect(screen.getByText('Subtasks 0/1')).toBeVisible()
  expect(screen.getByText('high priority')).toBeVisible()
  expect(screen.getByTestId('priority-icon')).toHaveAttribute('aria-hidden', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Show subtasks' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Outline' }))
  expect(check).toHaveBeenCalledWith(true, item.id)
})
