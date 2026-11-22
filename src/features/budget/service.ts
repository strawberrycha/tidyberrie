import { z } from '../../shared/db/strictValidation'
import { budgetCardsSchema } from '../../shared/db/schemas'
import type { Records } from '../../shared/db/schemas'
import { colors, icons, reminderOffset } from '../tasks/input'
import { repeatSchema } from '../tasks/repeatInput'
import { defaultRepeat, encodeRepeat, expandDates, addDays } from '../tasks/recurrence'
import { parseMoney } from './engine'
import { periods } from './model'
import type { BudgetTable } from './model'
import * as repository from './repository'

const id = z.uuid()
const date = z.iso.date()
const table = z.enum(['accounts', 'incomes', 'expenses', 'transfers'])
const name = z.string().trim().min(1, 'Enter a value.').max(80)
const amount = z.string().transform((value, ctx) => {
  const parsed = parseMoney(value)
  if (parsed !== undefined) return parsed
  ctx.addIssue({ code: 'custom', message: 'Enter pesos with up to two decimal places and no commas.' })
  return z.NEVER
})
const positive = amount.refine(value => value > 0, 'Enter an amount greater than zero.')
export const budgetSchemas = {
  accounts: z.strictObject({ name, type: z.enum(['cash', 'online']), color: z.enum(colors), icon: z.enum(icons), openingBalance: amount }),
  incomes: z.strictObject({ amount: positive, source: name, expectedDate: date, accountId: id }),
  expenses: z.strictObject({ amount: positive, category: name, date, accountId: id, notes: z.string().max(2000), repeat: repeatSchema,
    billReminder: reminderOffset.optional() })
    .superRefine(({ date, repeat }, ctx) => {
      if (repeat.until && (repeat.until < date || repeat.until > addDays(date, 366 * 50))) {
        ctx.addIssue({ code: 'custom', path: ['repeat'], message: 'Use an end date within 50 years of the first date.' })
      }
    }),
  transfers: z.strictObject({ amount: positive, date, fromAccountId: id, toAccountId: id })
    .refine(item => item.fromAccountId !== item.toAccountId, { path: ['toAccountId'], message: 'Choose a different destination.' }),
}

export const watchBudget = repository.watchBudget
export const readHistory = (limit: number) => repository.latestHistory(z.int().min(1).max(10000).parse(limit))
export const purgeBudget = () => repository.purgeBudget(new Date(Date.now() - 30 * 86_400_000).toISOString())

export function saveBudget<K extends BudgetTable>(kind: K, raw: unknown, recordId?: string, weekStart = 1) {
  table.parse(kind)
  if (recordId) id.parse(recordId)
  z.int().min(0).max(6).parse(weekStart)
  const value = budgetSchemas[kind].parse(raw)
  return repository.mutate(kind, recordId, recordId ? 'edit' : 'create', (current, stamp) => {
    if (current?.deletedAt) throw new Error('Restore the record before editing.')
    const next = { ...stamp, ...current, ...value, updatedAt: stamp.updatedAt }
    if ('repeat' in next) {
      const { repeat, ...fields } = next
      const paid = current && 'status' in current && current.status === 'paid'
      if (current && 'seriesId' in current && current.seriesId && current.date !== fields.date) {
        throw new Error('A settled repeat keeps its occurrence date.')
      }
      return { ...fields, billReminder: paid ? undefined : fields.billReminder, recurrenceRule: paid ? null : encodeRepeat(repeat, fields.date, weekStart), status: paid ? 'paid' : 'planned' } as Records[K]
    }
    return { ...next, ...(kind === 'incomes' && !current ? { status: 'expected' } : {}) } as Records[K]
  })
}

export function settleBudget(kind: 'incomes' | 'expenses', recordId: string, accountId: string, occurrence?: string) {
  z.enum(['incomes', 'expenses']).parse(kind)
  id.parse(recordId)
  id.parse(accountId)
  if (occurrence !== undefined) {
    date.parse(occurrence)
    if (kind !== 'expenses') throw new Error('Only expenses repeat.')
    return repository.settleOccurrence(recordId, occurrence, accountId,
      (rule, start) => expandDates(rule, start, occurrence, occurrence).length === 1)
  }
  return repository.mutate(kind, recordId, 'status', (current, stamp) => {
    if (!current || current.deletedAt) throw new Error('Record unavailable.')
    const status = kind === 'incomes' ? 'received' : 'paid'
    if (current.status === status) return
    if ('recurrenceRule' in current && current.recurrenceRule) throw new Error('Choose an expense occurrence.')
    return { ...current, status, accountId, updatedAt: stamp.updatedAt } as Records[typeof kind]
  })
}

export function setDeleted(kind: BudgetTable, recordId: string, deleted: boolean) {
  table.parse(kind)
  id.parse(recordId)
  z.boolean().parse(deleted)
  return repository.mutate(kind, recordId, deleted ? 'delete' : 'restore', (row, stamp) => {
    if (!row || Boolean(row.deletedAt) === deleted) return
    return { ...row, updatedAt: stamp.updatedAt, deletedAt: deleted ? stamp.createdAt : null }
  })
}

export const configureBudget = (value: string) => repository.savePreferences({ budgetView: z.enum(periods).parse(value), budgetConfigured: true })
export const setCards = (cards: unknown) => repository.savePreferences({ budgetCards: budgetCardsSchema.parse(cards) })
export const setHorizon = (value: string) => repository.savePreferences({ budgetHorizon: z.enum(['month', 'sahod']).parse(value) })

export async function seedSample(today: string) {
  if (!import.meta.env.DEV) return
  date.parse(today)
  const account = { ...repositorySeedStamp(), name: 'Sample wallet', type: 'cash' as const, openingBalance: 100000, icon: 'budget-day', color: 'rose' }
  const rows = { accounts: [account], incomes: [] as Records['incomes'][], expenses: [] as Records['expenses'][], transfers: [] }
  for (let index = 0; index < 2000; index++) {
    const stamp = repositorySeedStamp()
    const when = addDays(today, index % 61 - 30)
    if (index % 5 === 0) rows.incomes.push({ ...stamp, accountId: account.id, amount: 10000 + index, source: 'Sample income ' + index, expectedDate: when, status: index % 2 === 0 ? 'expected' : 'received' })
    else rows.expenses.push({ ...stamp, accountId: account.id, amount: 200 + index, date: when, category: 'Food', status: index % 2 === 0 ? 'planned' : 'paid',
      notes: 'Sample expense ' + index, recurrenceRule: null })
  }
  await repository.seedBudget(rows)
}

function repositorySeedStamp() {
  const time = new Date().toISOString()
  return { id: crypto.randomUUID(), createdAt: time, updatedAt: time, deletedAt: null }
}

export { defaultRepeat }
