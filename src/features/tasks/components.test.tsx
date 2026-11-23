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
afterEach(() => { cleanup(); vi.useRealTimers() })
afterAll(() => {
  for (const [name, descriptor] of Object.entries(original)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
})

it('offers local quick dates across a year boundary and rejects typed past dates', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 11, 31, 12))
  render(<TaskForm initial={emptyTask('2026-12-31')} title="Add task" busy={false} save={vi.fn()} close={vi.fn()} />)
  const field = screen.getByLabelText('Date')
  expect(field).toHaveAttribute('min', '2026-12-31')
  expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }))
  expect(field).toHaveValue('2027-01-01')
  fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
  expect(field).toHaveValue('2027-01-07')
  fireEvent.change(field, { target: { value: '2026-12-30' } })
  expect(screen.getByText('Pick today or a later date.')).toBeVisible()
})

it('focuses Title, validates, adds subtasks via Enter, traps Tab and supports Escape', async () => {
  const save = vi.fn()
  const close = vi.fn()
  const confirmDiscard = vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<TaskForm initial={emptyTask('2099-11-22')} title="Add task" busy={false} save={save} close={close} />)
  const title = screen.getByRole('textbox', { name: 'Title' })
  expect(title).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Save task' }))
  expect(await screen.findByText('Enter a title.')).toBeVisible()
  expect(save).not.toHaveBeenCalled()
  fireEvent.change(title, { target: { value: 'Read' } })
  expect(screen.queryByLabelText('Complete automatically when all subtasks are checked')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add subtask' }))
  expect(screen.getByLabelText('Complete automatically when all subtasks are checked')).toBeVisible()
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

it('shows scheduled time, accessible notification and task state without retired time fields', () => {
  const value = { ...initial, title: 'Wake', status: 'done' as const, allDay: false, startTime: '07:15',
    optional: true, alertNotify: true, alertAlarm: true, reminders: [0 as const], estimateMinutes: 10, actualMinutes: 8 }
  const task = { id: crypto.randomUUID(), createdAt: '', updatedAt: '', deletedAt: null, ...storedTask(value, 1) }
  const row = { group: { task, subtasks: [], exceptions: [] }, value }
  const { rerender } = render(<TaskCard row={row} now={new Date(2026, 10, 22)} timeFormat="24h" next
    canComplete disabled={false} check={vi.fn()} />)
  expect(screen.getByText('07:15')).toHaveClass('task-row-time')
  expect(screen.getByRole('img', { name: 'Notification on' })).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: 'Alarm on' })).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: /Done.*Wake/ })).toBeChecked()
  expect(screen.getByText('Next')).toBeVisible()
  expect(screen.getByText('Optional')).toBeVisible()
  expect(screen.queryByText('Est 10m')).not.toBeInTheDocument()
  rerender(<TaskCard row={{ ...row, value: { ...value, status: 'skipped' } }} now={new Date(2026, 10, 22)}
    canComplete disabled={false} check={vi.fn()} />)
  expect(screen.getByText('Skipped')).toBeVisible()
})

it('shows textual progress and a priority icon, and checks an expanded subtask', () => {
  const item = { ...newSubtask(), title: 'Outline' }
  const value = { ...initial, title: 'Write', priority: 'high' as const, subtasks: [item] }
  const task = { id: crypto.randomUUID(), createdAt: '', updatedAt: '', deletedAt: null, ...storedTask(value, 1) }
  const check = vi.fn()
  render(<TaskCard row={{ group: { task, subtasks: [], exceptions: [] }, value }} now={new Date(2026, 10, 22)}
    canComplete disabled={false} edit={() => {}} remove={() => {}} check={check} />)
  expect(screen.getByRole('button', { name: 'Subtasks 0/1' })).toBeVisible()
  expect(screen.getByText('high priority')).toBeVisible()
  expect(screen.getByTestId('priority-icon')).toHaveAttribute('aria-hidden', 'true')
  fireEvent.click(screen.getByRole('button', { name: /Subtasks/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Outline' }))
  expect(check).toHaveBeenCalledWith(true, item.id)
})
