import { useEffect, useState } from 'react'
import { useToast } from '../../shared/ui/Toast'
import type { TaskInput } from './input'
import type { TaskGroup } from './model'
import { changeCompletion, changeTaskStatus, duplicateTask, rescheduleTask, deleteTask, permanentlyDeleteTask, restoreTask, saveTask, watchTaskGroups } from './service'

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
      show({
        message,
        action: typeof undo === 'function' ? { label: 'Undo', run: async () => { await undo() } } : undefined,
      })
      after?.()
    } catch {
      show({ message: 'Could not save the task change. Try again.' })
    } finally {
      setBusy(false)
    }
  }
  return {
    busy,
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
    reschedule: (id: string, occurrence: string | undefined, date: string, after: () => void) =>
      perform(() => rescheduleTask(id, occurrence, date), 'Task rescheduled.', after),
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
