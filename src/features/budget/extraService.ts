import { z } from '../../shared/db/strictValidation'
import { reminderOffset } from '../tasks/input'
import { categoryKey, parseMoney, previewPurchase } from './engine'
import type { BudgetData } from './model'
import * as repository from './extraRepository'
import type { ExtraKind } from './extraRepository'
import { transactionCsv } from './csv'

const id = z.uuid()
const date = z.iso.date()
const kindSchema = z.enum(['categoryBudgets', 'goals', 'debts'])
const name = z.string().trim().min(1, 'Enter a value.').max(80)
const positive = z.string().transform((input, ctx) => {
  const amount = parseMoney(input)
  if (amount !== undefined && amount > 0) return amount
  ctx.addIssue({ code: 'custom', message: 'Enter a positive peso amount with up to two decimal places.' })
  return z.NEVER
})
const movement = z.strictObject({ recordId: id, accountId: id, date, amount: positive })

export const extraSchemas = {
  categoryBudgets: z.strictObject({ category: name, limit: positive }),
  goals: z.strictObject({ name, target: positive, targetDate: date.optional() }),
  debts: z.strictObject({ person: name, amount: positive, dueDate: date,
    direction: z.enum(['owe', 'owed', 'internal']), dueReminder: reminderOffset.optional(),
    fromAccountId: id.optional(), toAccountId: id.optional() }).superRefine((value, ctx) => {
      if (value.direction !== 'internal') return
      if (!value.fromAccountId) ctx.addIssue({ code: 'custom', path: ['fromAccountId'], message: 'Choose the account that owes.' })
      if (!value.toAccountId || value.fromAccountId === value.toAccountId) {
        ctx.addIssue({ code: 'custom', path: ['toAccountId'], message: 'Choose a different receiving account.' })
      }
    }),
  movement,
  preview: z.strictObject({ amount: positive, date }),
}

export function saveExtra(kind: ExtraKind, raw: unknown, recordId?: string) {
  kindSchema.parse(kind)
  if (recordId !== undefined) id.parse(recordId)
  if (kind === 'goals') return repository.saveGoal(extraSchemas.goals.parse(raw), recordId)
  if (kind === 'debts') {
    const value = extraSchemas.debts.parse(raw)
    return repository.saveExtra(kind, { ...value, fromAccountId: value.direction === 'internal' ? value.fromAccountId : undefined,
      toAccountId: value.direction === 'internal' ? value.toAccountId : undefined, dueReminder: value.dueReminder }, recordId)
  }
  const value = extraSchemas.categoryBudgets.parse(raw)
  return repository.saveExtra(kind, { ...value, categoryKey: categoryKey(value.category) }, recordId)
}

export function archiveExtra(kind: ExtraKind, recordId: string, deleted: boolean) {
  return repository.archiveExtra(kindSchema.parse(kind), id.parse(recordId), z.boolean().parse(deleted))
}

export function makeMovement(kind: 'goals' | 'debts', raw: unknown) {
  z.enum(['goals', 'debts']).parse(kind)
  const value = movement.parse(raw)
  const post = kind === 'goals' ? repository.contribute : repository.payDebt
  return post(value.recordId, value.accountId, value.amount, value.date)
}

export function purchasePreview(data: BudgetData, raw: unknown, today: string) {
  const value = extraSchemas.preview.parse(raw)
  return previewPurchase(data, value.date, value.amount, date.parse(today))
}

export function exportCsv(data: BudgetData) {
  return transactionCsv(data)
}

export function validSummaryMonth(value: string, today: string) {
  const month = date.safeParse(value + '-01')
  if (month.success && month.data <= date.parse(today)) return value
}
