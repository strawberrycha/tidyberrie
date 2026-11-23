import { z } from '../../shared/db/strictValidation'
import { newSubtask, taskInput, taskScheduleInput } from './input'
import type { TaskInput } from './input'
import { completedStatus, localTimestamp, storedTask, taskValue } from './model'
import type { TaskGroup } from './model'
import { expandDates, localDate } from './recurrence'
import * as repository from './repository'

const uuid = z.uuid()
const occurrenceDate = z.iso.date()
export const watchTaskGroups = repository.watchGroups
export function watchTasks(deleted: boolean, next: (groups: TaskGroup[]) => void, error: () => void) {
  return watchTaskGroups(deleted, groups => next(groups.filter(group => group.task.status !== 'skipped')), error)
}
export const purgeTasks = repository.purgeTasks
export const permanentlyDeleteTask = (id: string) => repository.permanentlyDelete(uuid.parse(id))

function requireGroup(group?: TaskGroup) {
  if (!group) throw new Error('Task unavailable')
  return group
}

function activeGroup(group?: TaskGroup) {
  const current = requireGroup(group)
  if (current.task.deletedAt) throw new Error('Task is in Trash')
  return current
}

type Metadata = Pick<TaskGroup['task'], 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>

function occurrenceRecord(group: TaskGroup, date: string, value: TaskInput, stamp: Metadata, mode: 'edit' | 'status' | 'check' | 'skip') {
  if (!group.task.repeatRule) throw new Error('Task does not repeat')
  const existing = group.exceptions.find(item => item.date === date && !item.deletedAt)
  if (!existing && !expandDates(group.task.repeatRule, group.task.startAt?.slice(0, 10) ?? date, date, date).length) {
    throw new Error('Occurrence unavailable')
  }
  const previous = mode === 'edit' ? { ...value, status: completedStatus(value) } : value
  const change: TaskGroup['exceptions'][number] = {
    ...stamp, ...existing, updatedAt: stamp.updatedAt,
    taskId: group.task.id, date,
    action: mode === 'skip' || previous.status === 'skipped' ? 'skipped' : previous.status === 'done' ? 'completed' : 'moved',
    movedTo: mode === 'edit' || mode === 'status' ? localTimestamp(value.startDate, value.allDay ? '' : value.startTime) : existing?.movedTo ?? null,
    subtaskStates: Object.fromEntries(previous.subtasks.map(item => [item.id, item.done])),
    override: mode === 'edit' || mode === 'status' ? previous : existing?.override && { ...existing.override, status: previous.status, originalDate: previous.originalDate },
  }
  return { ...group, exceptions: [...group.exceptions.filter(item => item.id !== change.id), change] }
}

export function saveTask(input: TaskInput, weekStart: number, id?: string, occurrence?: string) {
  const value = id ? taskInput.parse(input) : taskScheduleInput().parse(input)
  z.int().min(0).max(6).parse(weekStart)
  if (id) uuid.parse(id)
  if (occurrence) {
    occurrenceDate.parse(occurrence)
    if (!id) throw new Error('Occurrence requires a task')
  }
  return repository.changeGroup(id, (group, stamp) => {
    if (id) group = activeGroup(group)
    if (group) taskScheduleInput(taskValue(group, localDate(), occurrence)).parse(value)
    if (group) {
      const previous = taskValue(group, localDate(), occurrence)
      if (value.status !== previous.status) value.originalDate = null
    }
    if (occurrence && group) return occurrenceRecord(group, occurrence, value, stamp, 'edit')
    const base = storedTask(value, weekStart)
    const recurring = !!base.repeatRule
    const status = recurring ? (value.status === 'done' ? 'todo' : value.status) : completedStatus(value)
    const task = { ...stamp, ...group?.task, ...base, updatedAt: stamp.updatedAt, status }
    const previous = new Map(group?.subtasks.map(item => [item.id, item]))
    const children = value.subtasks.map((item, order) => {
      const original = previous.get(item.id)
      previous.delete(item.id)
      return {
        ...stamp, createdAt: original?.createdAt ?? stamp.createdAt, id: item.id, taskId: task.id,
        title: item.title, order, done: recurring ? false : item.done,
        dueAt: item.dueTime ? localTimestamp(value.startDate, item.dueTime) : undefined,
        reminder: item.reminder,
      }
    })
    return {
      task, subtasks: [...children, ...[...previous.values()].map(item =>
        item.deletedAt ? item : { ...item, deletedAt: stamp.updatedAt, updatedAt: stamp.updatedAt })],
      exceptions: group?.exceptions ?? [],
    }
  }, !id)
}

export function changeTaskStatus(id: string, occurrence: string | undefined, status: 'in_progress' | 'skipped') {
  uuid.parse(id)
  if (occurrence) occurrenceDate.parse(occurrence)
  z.enum(['in_progress', 'skipped']).parse(status)
  return repository.changeGroup(id, (previous, stamp) => {
    const group = activeGroup(previous)
    const value = { ...taskValue(group, localDate(), occurrence), status, originalDate: null }
    if (occurrence) return occurrenceRecord(group, occurrence, value, stamp, 'status')
    if (group.task.repeatRule) throw new Error('Choose a repeating occurrence.')
    return { ...group, task: { ...group.task, status, originalDate: null, updatedAt: stamp.updatedAt } }
  })
}

export function rescheduleTask(id: string, occurrence: string | undefined, date: string, now = new Date()) {
  uuid.parse(id)
  if (occurrence) occurrenceDate.parse(occurrence)
  occurrenceDate.parse(date)
  const today = localDate(now)
  if (date < today) throw new Error('Pick today or a later date.')
  return repository.changeGroup(id, (previous, stamp) => {
    const group = activeGroup(previous)
    if (group.task.repeatRule && !occurrence) throw new Error('Choose a repeating occurrence.')
    const value = taskValue(group, today, occurrence)
    if (date > value.startDate) {
      value.originalDate ??= value.startDate
      value.rescheduleCount++
      value.status = 'postponed'
    }
    value.startDate = date
    if (!value.allDay && value.startTime && +new Date(date + 'T' + value.startTime) <= +now) {
      value.allDay = true
      value.startTime = ''
      value.endTime = ''
      value.reminders = []
    }
    if (occurrence) return occurrenceRecord(group, occurrence, value, stamp, 'status')
    return {
      ...group, task: { ...group.task, ...storedTask(value, 0), updatedAt: stamp.updatedAt },
      subtasks: group.subtasks.map(item => item.deletedAt || !item.dueAt ? item : {
        ...item, dueAt: localTimestamp(date, item.dueAt.slice(11, 16)), updatedAt: stamp.updatedAt,
      }),
    }
  })
}

export function duplicateTask(id: string, weekStart: number, now = new Date()) {
  uuid.parse(id)
  return repository.inTaskTransaction(async () => {
    const source = activeGroup(await repository.readGroup(id))
    const today = localDate(now)
    const input = taskValue(source, today)
    if (input.startDate < today) input.startDate = today
    if (!input.allDay && input.startTime && +new Date(input.startDate + 'T' + input.startTime) <= +now) {
      input.allDay = true
      input.startTime = ''
      input.endTime = ''
    }
    const titles = await repository.taskTitles(input.startDate)
    if (titles.includes(input.title)) input.title = input.title.slice(0, 113) + ' (copy)'
    if (input.repeat.until && input.repeat.until < input.startDate) input.repeat = { ...input.repeat, until: input.startDate }
    const copy = {
      ...input, status: 'todo' as const, actualMinutes: null, originalDate: null, rescheduleCount: 0,
      subtasks: input.subtasks.map(item => ({ ...item, id: newSubtask().id, done: false })),
    }
    let copyId = ''
    const undo = await repository.changeGroup(undefined, (_, stamp) => {
      copyId = stamp.id
      const value = taskScheduleInput(undefined, now).parse(copy)
      return {
        task: { ...stamp, ...storedTask(value, z.int().min(0).max(6).parse(weekStart)) }, exceptions: [],
        subtasks: value.subtasks.map((item, order) => ({
          ...stamp, id: item.id, taskId: stamp.id, order, title: item.title, done: false,
          dueAt: item.dueTime ? localTimestamp(value.startDate, item.dueTime) : undefined, reminder: item.reminder,
        })),
      }
    })
    return { id: copyId, value: copy, undo }
  })
}

export function changeCompletion(id: string, occurrence: string | undefined, done: boolean, subtaskId?: string, reminderDate?: string) {
  uuid.parse(id)
  if (occurrence) occurrenceDate.parse(occurrence)
  if (reminderDate) occurrenceDate.parse(reminderDate)
  if (subtaskId) uuid.parse(subtaskId)
  z.boolean().parse(done)
  return repository.changeGroup(id, (previous, stamp) => {
    const group = activeGroup(previous)
    const date = occurrence ?? (group.task.repeatRule ? reminderDate : undefined)
    const value = taskValue(group, localDate(), date)
    if (subtaskId) {
      const item = value.subtasks.find(item => item.id === subtaskId)
      if (!item) throw new Error('Subtask unavailable')
      item.done = done
      value.status = completedStatus(value)
    } else {
      value.status = done ? 'done' : 'todo'
      value.originalDate = null
      if (value.autoCompleteWhenSubtasksDone) {
        value.subtasks = value.subtasks.map(item => ({ ...item, done }))
      }
    }
    if (date) return occurrenceRecord(group, date, value, stamp, 'check')
    const states = new Map(value.subtasks.map(item => [item.id, item.done]))
    return {
      ...group, task: { ...group.task, status: value.status, originalDate: value.originalDate, updatedAt: stamp.updatedAt },
      subtasks: group.subtasks.map(item => states.has(item.id) && states.get(item.id) !== item.done
        ? { ...item, done: states.get(item.id)!, updatedAt: stamp.updatedAt } : item),
    }
  })
}

export function deleteTask(id: string, occurrence?: string) {
  uuid.parse(id)
  if (occurrence) occurrenceDate.parse(occurrence)
  return repository.changeGroup(id, (previous, stamp) => {
    const group = activeGroup(previous)
    if (occurrence) return occurrenceRecord(group, occurrence, taskValue(group, occurrence, occurrence), stamp, 'skip')
    const mark = <T extends Metadata>(item: T) => item.deletedAt ? item : { ...item, deletedAt: stamp.updatedAt, updatedAt: stamp.updatedAt }
    return { task: mark(group.task), subtasks: group.subtasks.map(mark), exceptions: group.exceptions.map(mark) }
  })
}

export function restoreTask(id: string) {
  return repository.changeGroup(uuid.parse(id), (previous, stamp) => {
    const group = requireGroup(previous)
    const deletedAt = group.task.deletedAt
    if (!deletedAt) throw new Error('Task is not in Trash')
    const restore = <T extends Metadata>(item: T) => item.deletedAt === deletedAt
      ? { ...item, deletedAt: null, updatedAt: stamp.updatedAt } : item
    return { task: restore(group.task), subtasks: group.subtasks.map(restore), exceptions: group.exceptions.map(restore) }
  })
}
