import { db, table } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import { recordSchemas } from '../../shared/db/schemas'
import type { Records } from '../../shared/db/schemas'
import { audit, budgetTables, persist } from './repository'
import { debtProgress } from './engine'

export type ExtraKind = 'categoryBudgets' | 'goals' | 'debts'
type Details<K extends ExtraKind> = Omit<Records[K], keyof ReturnType<typeof metadata>>

function active(item: { deletedAt: string | null }) {
  return item.deletedAt === null
}

async function debtLedger(debtId: string) {
  return {
    incomes: await table('incomes').where('debtId').equals(debtId).toArray(),
    expenses: await table('expenses').where('debtId').equals(debtId).toArray(),
    transfers: await table('transfers').where('debtId').equals(debtId).toArray(),
  }
}

async function validateExtra<K extends ExtraKind>(kind: K, next: Records[K]) {
  if (kind === 'categoryBudgets' && 'categoryKey' in next && active(next)) {
    const duplicate = await table('categoryBudgets').where('categoryKey').equals(next.categoryKey)
      .filter(item => active(item) && item.id !== next.id).first()
    if (duplicate) throw new Error('This category already has a monthly limit.')
  }
  if (kind === 'goals' && 'accountId' in next && active(next)) {
    const account = await table('accounts').get(next.accountId)
    if (!account || !active(account)) throw new Error('Restore the linked savings account first.')
  }
  if (kind === 'debts' && 'direction' in next) {
    const ledger = await debtLedger(next.id)
    const live = [...ledger.incomes, ...ledger.expenses, ...ledger.transfers].filter(active)
    if (live.length && !active(next)) throw new Error('Undo or remove the linked payments before archiving this utang.')
    if (next.direction !== 'owed' && ledger.incomes.some(active) ||
      next.direction !== 'owe' && ledger.expenses.some(active) ||
      ledger.transfers.some(item => active(item) && (next.direction !== 'internal' ||
        item.fromAccountId !== next.fromAccountId || item.toAccountId !== next.toAccountId))) {
      throw new Error('Direction and linked accounts cannot change after recording a payment.')
    }
    if (active(next) && next.direction === 'internal') {
      for (const id of [next.fromAccountId, next.toAccountId]) {
        const account = id ? await table('accounts').get(id) : undefined
        if (!account || !active(account)) throw new Error('Choose two active linked accounts.')
      }
    }
    if (debtProgress(next, ledger).remaining < 0n) throw new Error('Principal cannot be less than payments already recorded.')
  }
}

async function persistExtra<K extends ExtraKind>(kind: K, before: Records[K] | undefined, next: Records[K], field: string) {
  const record = recordSchemas[kind].parse(next) as Records[K]
  await validateExtra(kind, record)
  await table(kind).put(record)
  await audit(kind, record.id, field, before, record)
  return () => db.transaction('rw', budgetTables, async () => {
    const current = await table(kind).get(record.id)
    if (JSON.stringify(current) !== JSON.stringify(record)) throw new Error('This record changed after the action.')
    const stamp = metadata()
    const restored = before ? { ...before, updatedAt: stamp.updatedAt } : { ...record, deletedAt: stamp.createdAt, updatedAt: stamp.updatedAt }
    await validateExtra(kind, restored)
    await table(kind).put(restored)
    await audit(kind, record.id, 'undo', current, restored)
  })
}

export function saveExtra<K extends ExtraKind>(kind: K, details: Details<K>, id?: string) {
  return db.transaction('rw', budgetTables, async () => {
    const prior = id ? await table(kind).get(id) : undefined
    if (id && (!prior || !active(prior))) throw new Error('Record is unavailable.')
    const stamp = metadata()
    return persistExtra(kind, prior, { ...stamp, ...prior, ...details, updatedAt: stamp.updatedAt } as Records[K], id ? 'edit' : 'create')
  })
}

export function saveGoal(details: Omit<Details<'goals'>, 'accountId'>, id?: string) {
  return db.transaction('rw', budgetTables, async () => {
    if (id) {
      const previous = await table('goals').get(id)
      if (!previous || !active(previous)) throw new Error('Goal is unavailable.')
      return saveExtra('goals', { ...details, accountId: previous.accountId }, id)
    }
    const account = {
      ...metadata(), name: 'Savings: ' + details.name, type: 'online' as const,
      openingBalance: 0, color: 'mint', icon: 'goals',
    }
    const undoAccount = await persist('accounts', undefined, account, 'create')
    const undoGoal = await saveExtra('goals', { ...details, accountId: account.id })
    return () => db.transaction('rw', budgetTables, async () => {
      await undoGoal()
      await undoAccount()
    })
  })
}

export function archiveExtra(kind: ExtraKind, id: string, deleted: boolean) {
  return db.transaction('rw', budgetTables, async () => {
    const previous = await table(kind).get(id)
    if (!previous || !!previous.deletedAt === deleted) return
    const stamp = metadata()
    return persistExtra(kind, previous, { ...previous, updatedAt: stamp.updatedAt,
      deletedAt: deleted ? stamp.createdAt : null }, deleted ? 'delete' : 'restore')
  })
}

export function contribute(id: string, accountId: string, amount: number, date: string) {
  return db.transaction('rw', budgetTables, async () => {
    const goal = await table('goals').get(id)
    if (!goal || !active(goal)) throw new Error('Goal is unavailable.')
    return persist('transfers', undefined, { ...metadata(), amount, date, fromAccountId: accountId, toAccountId: goal.accountId }, 'create')
  })
}

export function payDebt(id: string, accountId: string, amount: number, date: string) {
  return db.transaction('rw', budgetTables, async () => {
    const debt = await table('debts').get(id)
    if (!debt || !active(debt)) throw new Error('Utang is unavailable.')
    const base = { ...metadata(), accountId, amount, debtId: debt.id }
    if (debt.direction === 'internal') {
      if (accountId !== debt.fromAccountId || !debt.toAccountId) throw new Error('Choose the source account linked to this utang.')
      return persist('transfers', undefined, {
        ...metadata(), amount, date, debtId: id, fromAccountId: accountId, toAccountId: debt.toAccountId,
      }, 'create')
    }
    if (debt.direction === 'owed') return persist('incomes', undefined, {
      ...base, source: 'Utang repayment · ' + debt.person, expectedDate: date, status: 'received',
    }, 'create')
    return persist('expenses', undefined, {
      ...base, category: 'Utang repayment', notes: debt.person, date, status: 'paid', recurrenceRule: null,
    }, 'create')
  })
}
