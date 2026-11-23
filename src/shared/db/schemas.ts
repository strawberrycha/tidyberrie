import { z } from './strictValidation'
import { centavos } from '../utils/money'
import { themes } from '../theme/tokens'
import { scheduleDraft, scheduledTaskFields } from '../../features/tasks/scheduleInput'
import { taskInput } from '../../features/tasks/input'
import { categoryFields, defaultCategories, normalizedStatus, taskFields } from '../../features/tasks/categoryData'

const id = z.uuid()
const timestamp = z.iso.datetime({ offset: true })
const date = z.iso.date()
const dateOrTime = z.union([date, timestamp])
const text = z.string()
const base = z.strictObject({ id, createdAt: timestamp, updatedAt: timestamp, deletedAt: timestamp.nullable() })
const reminder = z.int().nonnegative()
const backupReminder = z.boolean()
export const budgetCardsSchema = z.array(z.strictObject({
  key: z.enum(['leftMonth','leftOverall','netMonth','safe','money','income','available','paid','planned']),
  label: text.trim().min(1).max(40), color: z.enum(['rose','blush','peach','berry','lavender','mint','honey','sky']),
  visible: z.boolean(), home: z.boolean(),
})).max(9).refine(cards => new Set(cards.map(card => card.key)).size === cards.length)

export const recordSchemas = {
  tasks: base.extend({
    title: text, description: text, startAt: dateOrTime.nullable(), endAt: dateOrTime.nullable(),
    allDay: z.boolean(), color: text, icon: text, tag: text,
    priority: z.enum(['low', 'medium', 'high']), status: normalizedStatus,
    ...taskFields,
    ...scheduledTaskFields,
    repeatRule: text.nullable(), reminders: z.array(reminder),
    autoCompleteWhenSubtasksDone: z.boolean(), pinned: z.boolean(),
  }),
  schedules: base.extend(scheduleDraft.shape).extend({ order: z.int() })
    .refine(item => !item.startDate || !item.endDate || item.endDate >= item.startDate, { path: ['endDate'] }),
  categories: base.extend(categoryFields),
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
  incomes: base.extend({ amount: centavos.nonnegative(), source: text, expectedDate: date, status: z.enum(['expected', 'received']), accountId: id, debtId: id.optional() }),
  expenses: base.extend({ amount: centavos.nonnegative(), category: text, date, status: z.enum(['planned', 'paid']),
    recurrenceRule: text.nullable(), accountId: id, notes: text.max(2000).optional(), seriesId: id.optional(),
    debtId: id.optional(), billReminder: z.literal([0, 5, 15, 30, 60, 1440]).optional() }),
  transfers: base.extend({ amount: centavos.positive(), date, fromAccountId: id, toAccountId: id, debtId: id.optional() })
    .refine(item => item.fromAccountId !== item.toAccountId),
  categoryBudgets: base.extend({ category: text.trim().min(1).max(80), categoryKey: text.min(1).max(160), limit: centavos.positive() }),
  goals: base.extend({ name: text.trim().min(1).max(80), target: centavos.positive(), targetDate: date.optional(), accountId: id }),
  debts: base.extend({ person: text.trim().min(1).max(80), direction: z.enum(['owe','owed','internal']), amount: centavos.positive(),
    dueDate: date, dueReminder: z.literal([0, 5, 15, 30, 60, 1440]).optional(), fromAccountId: id.optional(), toAccountId: id.optional() })
    .refine(item => item.direction === 'internal'
      ? !!item.fromAccountId && !!item.toAccountId && item.fromAccountId !== item.toAccountId
      : !item.fromAccountId && !item.toAccountId),
  budgetHistory: base.extend({ entityType: text, entityId: id, field: text, oldValue: z.json(), newValue: z.json(), changedAt: timestamp }),
  settings: base.extend({
    key: z.enum(['preferences', 'undo-demo']), theme: z.enum(themes), storagePersistent: z.boolean().nullable(),
    budgetView: z.enum(['daily', 'monthly', 'yearly']), avatar: text, currency: z.literal('PHP'),
    yourName: z.string().trim().min(1).max(40).optional(), timeFormat: z.enum(['12h', '24h']).optional(),
    lastCategoryId: id.nullable().optional(),
    textSize: z.literal([100, 125, 150, 200]).optional(),
    weekStart: z.int().min(0).max(6), dashboardCards: z.array(text), backupReminder,
    budgetConfigured: z.boolean().optional(), budgetCards: budgetCardsSchema.optional(),
    budgetHorizon: z.enum(['month','sahod']).optional(),
  }),
}

const backupCategories = z.array(recordSchemas.categories).refine(items => {
  const names = items.filter(item => !item.archived && !item.deletedAt).map(item => item.name.toLowerCase())
  return new Set(names).size === names.length
}, 'Active category names must be unique.')

export const backupDataSchema = z.strictObject({
  schedules: z.array(recordSchemas.schedules).refine(items => {
    const active = items.filter(item => !item.deletedAt).map(item => item.name.toLowerCase())
    return new Set(active).size === active.length
  }, 'Active schedule names must be unique.').default([]),
  categories: backupCategories.default(() => defaultCategories('1970-01-01T00:00:00.000Z')),
  tasks: z.array(recordSchemas.tasks), subtasks: z.array(recordSchemas.subtasks),
  taskExceptions: z.array(recordSchemas.taskExceptions), dayThemes: z.array(recordSchemas.dayThemes),
  accounts: z.array(recordSchemas.accounts), incomes: z.array(recordSchemas.incomes),
  expenses: z.array(recordSchemas.expenses), budgetHistory: z.array(recordSchemas.budgetHistory),
  transfers: z.array(recordSchemas.transfers).default([]),
  categoryBudgets: z.array(recordSchemas.categoryBudgets).default([]),
  goals: z.array(recordSchemas.goals).default([]),
  debts: z.array(recordSchemas.debts).default([]),
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
