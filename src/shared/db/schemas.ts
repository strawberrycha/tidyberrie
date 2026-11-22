import { z } from 'zod'
import { centavos } from '../utils/money'
import { themes } from '../theme/tokens'
import { taskInput } from '../../features/tasks/input'

const id = z.uuid()
const timestamp = z.iso.datetime({ offset: true })
const date = z.iso.date()
const dateOrTime = z.union([date, timestamp])
const text = z.string()
const base = z.strictObject({ id, createdAt: timestamp, updatedAt: timestamp, deletedAt: timestamp.nullable() })
const reminder = z.int().nonnegative()
const backupReminder = z.boolean()

export const recordSchemas = {
  tasks: base.extend({
    title: text, description: text, startAt: dateOrTime.nullable(), endAt: dateOrTime.nullable(),
    allDay: z.boolean(), color: text, icon: text, tag: text,
    priority: z.enum(['low', 'medium', 'high']), status: z.enum(['todo', 'doing', 'done']),
    repeatRule: text.nullable(), reminders: z.array(reminder),
    autoCompleteWhenSubtasksDone: z.boolean(), pinned: z.boolean(),
  }),
  subtasks: base.extend({ taskId: id, title: text, done: z.boolean(), order: z.int(), dueAt: dateOrTime.optional(), reminder: reminder.optional() }),
  taskExceptions: base.extend({
    taskId: id, date, action: z.enum(['skipped', 'moved', 'completed']),
    movedTo: dateOrTime.nullable(), subtaskStates: z.record(id, z.boolean()),
    override: taskInput.optional(),
  }),
  dayThemes: base.extend({
    weekday: z.int().min(0).max(6).optional(), date: date.optional(), name: text, icon: text, color: text,
    catalog: z.literal(true).optional(), themeKey: text.max(40).optional(),
  }).refine(record => record.catalog
    ? record.weekday === undefined && record.date === undefined && record.themeKey === undefined
    : (record.weekday === undefined) !== (record.date === undefined)),
  accounts: base.extend({ name: text, type: z.enum(['cash', 'online']), openingBalance: centavos, color: text, icon: text }),
  incomes: base.extend({ amount: centavos.nonnegative(), source: text, expectedDate: date, status: z.enum(['expected', 'received']), accountId: id }),
  expenses: base.extend({ amount: centavos.nonnegative(), category: text, date, status: z.enum(['planned', 'paid']), recurrenceRule: text.nullable(), accountId: id }),
  budgetHistory: base.extend({ entityType: text, entityId: id, field: text, oldValue: z.json(), newValue: z.json(), changedAt: timestamp }),
  settings: base.extend({
    key: z.enum(['preferences', 'undo-demo']), theme: z.enum(themes), storagePersistent: z.boolean().nullable(),
    budgetView: z.enum(['daily', 'monthly', 'yearly']), avatar: text, currency: z.literal('PHP'),
    weekStart: z.int().min(0).max(6), dashboardCards: z.array(text), backupReminder,
  }),
}

export const backupDataSchema = z.strictObject({
  tasks: z.array(recordSchemas.tasks), subtasks: z.array(recordSchemas.subtasks),
  taskExceptions: z.array(recordSchemas.taskExceptions), dayThemes: z.array(recordSchemas.dayThemes),
  accounts: z.array(recordSchemas.accounts), incomes: z.array(recordSchemas.incomes),
  expenses: z.array(recordSchemas.expenses), budgetHistory: z.array(recordSchemas.budgetHistory),
  settings: z.array(recordSchemas.settings),
})

export const snapshotSchema = base.extend({ day: date, data: backupDataSchema })
export const backupSchema = z.strictObject({
  version: z.literal(1), exportedAt: timestamp,
  data: backupDataSchema.extend({ snapshots: z.array(snapshotSchema).max(7) }),
}).superRefine(({ data }, context) => {
  for (const [table, records] of Object.entries(data)) {
    const keys = records.map(record =>
      'key' in record ? record.key : 'day' in record ? record.day : record.id)
    if (new Set(keys).size !== keys.length || new Set(records.map(record => record.id)).size !== records.length) {
      context.addIssue({ code: 'custom', path: ['data', table], message: 'Duplicate record' })
    }
  }
})

export type Backup = z.infer<typeof backupSchema>
export type Records = { [K in keyof Backup['data']]: Backup['data'][K][number] }
export type RecordMetadata = z.infer<typeof base>
