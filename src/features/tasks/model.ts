import type { Records } from '../../shared/db/schemas'
import { colors, emptyTask, icons, reminderOffset } from './input'
import type { SubtaskInput, TaskInput } from './input'
import { decodeRepeat, encodeRepeat } from './recurrence'

export type Task = Records['tasks']
export type Subtask = Records['subtasks']
export type TaskException = Records['taskExceptions']
export type TaskGroup = { schedule?: Records['schedules']; task: Task; subtasks: Subtask[]; exceptions: TaskException[] }
export type TaskRow = { group: TaskGroup; occurrence?: string; value: TaskInput }

export function compareScheduleTasks(a: Task, b: Task) {
  return (a.startAt?.slice(11, 16) ?? '').localeCompare(b.startAt?.slice(11, 16) ?? '') ||
    (a.scheduleOrder ?? Number.MAX_SAFE_INTEGER) - (b.scheduleOrder ?? Number.MAX_SAFE_INTEGER) ||
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

export function timeOf(value?: string | null) {
  return value?.slice(11, 16) ?? ''
}

export function localTimestamp(date: string, time: string) {
  if (!time) return date
  const wallTime = new Date(date + 'T' + time + ':00')
  const offset = -wallTime.getTimezoneOffset()
  const sign = offset < 0 ? '-' : '+'
  const hour = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
  const minute = String(Math.abs(offset) % 60).padStart(2, '0')
  return date + 'T' + time + ':00' + sign + hour + ':' + minute
}

export function storedTask(value: TaskInput, weekStart: number) {
  return {
    title: value.title, description: value.description,
    startAt: localTimestamp(value.startDate, value.allDay ? '' : value.startTime),
    endAt: value.endTime && !value.allDay ? localTimestamp(value.startDate, value.endTime) : null,
    allDay: value.allDay, color: value.color, icon: value.icon, tag: value.tag,
    priority: value.priority, status: value.status, pinned: value.pinned,
    scheduleId: value.scheduleId, alertNotify: value.alertNotify, alertAlarm: value.alertAlarm,
    categoryId: value.categoryId, optional: value.optional, estimateMinutes: value.estimateMinutes,
    actualMinutes: value.actualMinutes, originalDate: value.originalDate, rescheduleCount: value.rescheduleCount,
    repeatRule: value.scheduleId ? null : encodeRepeat(value.repeat, value.startDate, weekStart),
    reminders: value.reminders, autoCompleteWhenSubtasksDone: value.autoCompleteWhenSubtasksDone,
  }
}

export const isOpen = (status: TaskInput['status']) => status !== 'done' && status !== 'skipped'

export function completedStatus(value: TaskInput) {
  if (value.status === 'skipped') return value.status
  if (!value.autoCompleteWhenSubtasksDone || !value.subtasks.length) return value.status
  return value.subtasks.every(item => item.done) ? 'done' : value.status === 'done' ? 'todo' : value.status
}

export function progress(subtasks: SubtaskInput[]) {
  return { total: subtasks.length, done: subtasks.filter(item => item.done).length }
}

export function taskValue(group: TaskGroup, fallback: string, occurrence?: string): TaskInput {
  const { task } = group
  const base = emptyTask(fallback)
  const subtasks = group.subtasks.filter(item => !item.deletedAt).sort((a, b) => a.order - b.order)
    .map(item => ({ id: item.id, title: item.title, done: item.done, dueTime: timeOf(item.dueAt),
      reminder: reminderOffset.safeParse(item.reminder).data }))
  const value: TaskInput = {
    ...base, title: task.title, description: task.description, startDate: task.startAt?.slice(0, 10) ?? fallback,
    startTime: timeOf(task.startAt), endTime: timeOf(task.endAt), allDay: task.allDay,
    color: colors.find(color => color === task.color) ?? base.color,
    icon: icons.find(icon => icon === task.icon) ?? base.icon,
    tag: task.tag, priority: task.priority, status: task.status,
    scheduleId: task.scheduleId, alertNotify: task.alertNotify, alertAlarm: task.alertAlarm,
    categoryId: task.categoryId, optional: task.optional, estimateMinutes: task.estimateMinutes,
    actualMinutes: task.actualMinutes, originalDate: task.originalDate, rescheduleCount: task.rescheduleCount,
    repeat: decodeRepeat(task.repeatRule), reminders: task.reminders.flatMap(offset => {
      const result = reminderOffset.safeParse(offset)
      return result.success ? [result.data] : []
    }), pinned: task.pinned,
    autoCompleteWhenSubtasksDone: task.autoCompleteWhenSubtasksDone, subtasks,
  }
  return occurrence
    ? occurrenceValue(value, occurrence, group.exceptions.find(item => !item.deletedAt && item.date === occurrence))
    : value
}

export function occurrenceValue(base: TaskInput, occurrence: string, exception?: TaskException): TaskInput {
  const draft: TaskInput = {
    ...base,
    startDate: exception?.movedTo?.slice(0, 10) ?? occurrence,
    startTime: exception?.movedTo ? timeOf(exception.movedTo) : base.startTime,
    status: base.status === 'done' ? 'todo' : base.status,
    ...exception?.override,
  }
  return {
    ...draft,
    repeat: base.repeat,
    status: exception?.action === 'completed' ? 'done' : exception?.action === 'skipped' ? 'skipped' : draft.status,
    categoryId: base.categoryId,
    scheduleId: base.scheduleId,
    subtasks: draft.subtasks.map(item => ({ ...item, done: exception?.subtaskStates[item.id] ?? false })),
  }
}
