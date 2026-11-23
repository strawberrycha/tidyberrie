import { useEffect, useState } from 'react'
import { useToast } from '../../shared/ui/Toast'
import type { TaskInput } from './input'
import type { BulkChange, TaskTarget } from './service'
import type { TaskGroup } from './model'
import { applyBulkTaskChange, changeCompletion, changeTaskStatus, duplicateTask, deleteTask, permanentlyDeleteTask, restoreTask, saveTask, watchTaskGroups } from './service'

export function useTaskGroups(trash: boolean) {
  const [state, setState] = useState<{ trash: boolean; groups?: TaskGroup[]; error?: boolean }>()
  useEffect(() => watchTaskGroups(trash, groups => setState({ trash, groups }), () => setState({ trash, error: true })), [trash])
  return state?.trash === trash ? state : undefined
}

export function useTaskActions() {
  const show = useToast()
  const [busy, setBusy] = useState(false)

  async function perform(operation: () => Promise<unknown>, message: string, after?: () => void) {
    if (busy) return
    setBusy(true)
    try {
      const undo = await operation()
      if (message) show({
        message,
        action: typeof undo === 'function' ? { label: 'Undo', run: async () => { await undo() } } : undefined,
      })
      after?.()
    } catch (error) {
      const message = error instanceof Error && /^(That time|Pick a date|Pick today|Set a start time|Choose an active schedule)/.test(error.message)
        ? error.message : 'Could not save the task change. Try again.'
      show({ message })
    } finally {
      setBusy(false)
    }
  }
  return {
    busy,
    bulk: (targets: TaskTarget[], change: BulkChange, after: () => void) => perform(async () => {
      const result = await applyBulkTaskChange(targets, change)
      const count = result.count === 1 ? '1 task' : result.count + ' tasks'
      const labels = { done: 'marked done', skip: 'skipped', category: 'updated', schedule: 'moved', date: 'moved', delete: 'deleted' }
      const detail = result.timeRemoved ? result.count === 1 ? ' (time removed because it already passed)' : ' (' + result.timeRemoved + ' elapsed times removed)' : ''
      const message = change.kind === 'date' && result.count === 1 && result.timeRemoved
        ? 'Moved to today (time removed because it already passed).' : count + ' ' + labels[change.kind] + detail + '.'
      show({ message, action: { label: 'Undo', run: result.undo } })
    }, '', after),
    save: (value: TaskInput, weekStart: number, id: string | undefined, date: string | undefined, after: () => void) =>
      perform(async () => {
        const undo = await saveTask(value, weekStart, id, date)
        return id ? undo : undefined
      }, id ? 'Task updated.' : 'Task added.', () => {
        after()
        if (value.reminders.length || value.subtasks.some(item => item.reminder !== undefined)) {
          window.dispatchEvent(new Event('tidyberrie-reminder-explain'))
        }
      }),
    status: (id: string, date: string | undefined, status: 'in_progress' | 'skipped') =>
      perform(() => changeTaskStatus(id, date, status), status === 'skipped' ? 'Task skipped.' : 'Task in progress.'),
    duplicate: (id: string, weekStart: number, open: (id: string, value: TaskInput) => void) =>
      perform(async () => { const copy = await duplicateTask(id, weekStart); open(copy.id, copy.value); return copy.undo }, 'Task duplicated.'),
    check: (id: string, date: string | undefined, done: boolean, subtaskId?: string) =>
      perform(() => changeCompletion(id, date, done, subtaskId),
        subtaskId ? (done ? 'Subtask checked.' : 'Subtask unchecked.') : done ? 'Task completed.' : 'Task reopened.'),
    remove: (id: string, date: string | undefined, after: () => void) =>
      perform(() => deleteTask(id, date), date ? 'Occurrence deleted.' : 'Task deleted.', after),
    restore: (id: string) => perform(() => restoreTask(id), 'Task restored.'),
    erase: (id: string, after: () => void) => perform(() => permanentlyDeleteTask(id), 'Task permanently deleted.', after),
    seed: (weekStart: number, after: () => void) => {
      if (import.meta.env.DEV) return perform(async () => {
        await (await import('./seed')).seedTasks(weekStart)
      }, 'Added 1,000 sample tasks.', after)
    },
  }
}
