import { z } from '../../shared/db/strictValidation'
import { scheduledTaskFields } from './scheduleInput'
import { iconKeys } from '../../assets/stickers/keys'
import { normalizedStatus, statuses, taskFields, taskFieldDefaults } from './categoryData'
export { statuses }
import { localDate } from './recurrence'
import { defaultRepeat, repeatSchema } from './repeatInput'

export const colors = ['rose', 'blush', 'peach', 'berry', 'lavender', 'mint', 'honey', 'sky'] as const
export const colorLabels = ['Rose', 'Blush', 'Peach', 'Berry', 'Lavender', 'Mint', 'Honey', 'Sky']
export const icons = iconKeys
export const priorities = ['low', 'medium', 'high'] as const
export const statusLabels = { todo: 'To do', in_progress: 'In progress', done: 'Done', skipped: 'Skipped', postponed: 'Postponed' }
export const offsets = [0, 5, 15, 30, 60, 1440] as const
export const reminderOffset = z.literal(offsets)
const title = z.string().trim().min(1, 'Enter a title.').max(120, 'Use at most 120 characters.')
const time = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Enter a valid time.')
const optionalTime = z.union([z.literal(''), time])

export const subtaskInput = z.strictObject({
  id: z.uuid(), title, done: z.boolean(), dueTime: optionalTime, reminder: reminderOffset.optional(),
}).superRefine((value, context) => {
  if (value.reminder !== undefined && !value.dueTime) {
    context.addIssue({ code: 'custom', path: ['dueTime'], message: 'Set a due time for the reminder.' })
  }
})

export const taskInput = z.strictObject({
  title, description: z.string().max(2000), startDate: z.iso.date({ error: 'Choose a valid date.' }),
  startTime: optionalTime, endTime: optionalTime, allDay: z.boolean(),
  color: z.union([z.literal(''), z.enum(colors)]), icon: z.enum(icons), tag: z.string().trim().max(30),
  priority: z.enum(priorities), status: normalizedStatus, ...taskFields, ...scheduledTaskFields, repeat: repeatSchema,
  reminders: z.array(reminderOffset).max(6),
  pinned: z.boolean(), autoCompleteWhenSubtasksDone: z.boolean(),
  subtasks: z.array(subtaskInput).max(100),
}).superRefine((value, context) => {
  if (value.scheduleId && (value.allDay || !value.startTime)) {
    context.addIssue({ code: 'custom', path: ['startTime'], message: 'Enter a start time for the schedule.' })
  }
  if (!value.allDay && value.endTime && (!value.startTime || value.endTime < value.startTime)) {
    context.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be at or after the start time.' })
  }
  if (value.repeat.until && value.repeat.until < value.startDate) {
    context.addIssue({ code: 'custom', path: ['repeat', 'until'], message: 'End date must be on or after the start date.' })
  }
  if (new Set(value.subtasks.map(item => item.id)).size !== value.subtasks.length) {
    context.addIssue({ code: 'custom', path: ['subtasks'], message: 'Duplicate subtasks.' })
  }
})

export type TaskInput = z.infer<typeof taskInput>
export type SubtaskInput = z.infer<typeof subtaskInput>

// Form and service share the same rule. Stored/imported records use the structural schema.
export function taskScheduleInput(previous?: TaskInput, now = new Date(), occurrence = false) {
  return taskInput.superRefine((value, context) => {
    if (value.scheduleId && !occurrence) return
    const today = localDate(now)
    const changedDate = !previous || previous.startDate !== value.startDate
    const changedStart = changedDate || previous.allDay !== value.allDay || previous.startTime !== value.startTime
    if (value.startDate < today && changedDate) {
      context.addIssue({ code: 'custom', path: ['startDate'], message: 'Pick today or a later date.' })
      return
    }
    if (!value.allDay && value.startTime && (previous ? changedStart : value.reminders.length > 0)
      && +new Date(value.startDate + 'T' + value.startTime) < +now) {
      context.addIssue({ code: 'custom', path: ['startTime'], message: 'That time has already passed.' })
    }
  })
}

export function emptyTask(date: string): TaskInput {
  return {
    ...taskFieldDefaults, scheduleId: null, alertNotify: false, alertAlarm: false, title: '', description: '', startDate: date, startTime: '', endTime: '', allDay: true,
    color: '', icon: 'check', tag: '', priority: 'medium', status: 'todo',
    repeat: defaultRepeat, reminders: [], pinned: false, autoCompleteWhenSubtasksDone: false, subtasks: [],
  }
}

export function newSubtask(): SubtaskInput {
  return { id: crypto.randomUUID(), title: '', done: false, dueTime: '' }
}
