import { liveQuery } from 'dexie'
import { db, table } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import { recordSchemas } from '../../shared/db/schemas'
import type { Records } from '../../shared/db/schemas'
import type { BudgetTable, BudgetData } from './model'

const names = ['accounts', 'incomes', 'expenses', 'transfers'] as const
const tables = ([...names, 'budgetHistory', 'settings'] as const).map(name => table(name))
type Entity = Records[BudgetTable]

export function readBudget() {
  return db.transaction('r', tables, async () => ({
    accounts: await table('accounts').toArray(), incomes: await table('incomes').toArray(),
    expenses: await table('expenses').toArray(), transfers: await table('transfers').toArray(),
    preferences: await table('settings').get({ key: 'preferences' }),
  }))
}

export function watchBudget(next: (value: Awaited<ReturnType<typeof readBudget>>) => void, error: () => void) {
  const subscription = liveQuery(readBudget).subscribe({ next, error })
  return () => subscription.unsubscribe()
}

export function latestHistory(limit: number) {
  return table('budgetHistory').orderBy('changedAt').reverse().filter(item => !item.deletedAt).limit(limit).toArray()
}

function json(value: unknown) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value))
}

async function audit(kind: BudgetTable, id: string, field: string, from: unknown, to: unknown) {
  const stamp = metadata()
  await table('budgetHistory').add(recordSchemas.budgetHistory.parse({
    ...stamp, entityType: kind, entityId: id, field, oldValue: json(from), newValue: json(to), changedAt: stamp.createdAt,
  }))
}

async function verifyReferences(record: Entity) {
  if (record.deletedAt) return
  const ids = 'accountId' in record ? [record.accountId]
    : 'fromAccountId' in record ? [record.fromAccountId, record.toAccountId] : []
  for (const id of ids) {
    const account = await table('accounts').get(id)
    if (!account || account.deletedAt) throw new Error('Choose an active account.')
  }
}

async function verifyAccountRemoval(id: string) {
  const active = (item: Entity) => !item.deletedAt
  const used = await Promise.all([
    table('incomes').where('accountId').equals(id).filter(active).first(),
    table('expenses').where('accountId').equals(id).filter(active).first(),
    table('transfers').where('fromAccountId').equals(id).filter(active).first(),
    table('transfers').where('toAccountId').equals(id).filter(active).first(),
  ])
  if (used.some(Boolean)) throw new Error('Move or delete this account’s transactions first.')
}

async function persist<K extends BudgetTable>(kind: K, before: Records[K] | undefined, next: Records[K], operation: string) {
  const parsed = recordSchemas[kind].parse(next) as Records[K]
  await verifyReferences(parsed)
  if (kind === 'accounts' && parsed.deletedAt) await verifyAccountRemoval(parsed.id)
  await table(kind).put(parsed)

  if (operation === 'edit' && before) {
    const old = Object.fromEntries(Object.entries(before))
    for (const [key, value] of Object.entries(parsed)) {
      if (key !== 'updatedAt' && json(old[key]) !== json(value)) await audit(kind, parsed.id, key, old[key], value)
    }
  } else if (operation === 'status' && ('status' in parsed)) {
    await audit(kind, parsed.id, 'status',
      before && !before.deletedAt && 'status' in before ? { status: before.status, accountId: before.accountId } : { status: 'planned' },
      { status: parsed.status, accountId: parsed.accountId })
  } else {
    await audit(kind, parsed.id, operation, before, parsed)
  }

  return () => db.transaction('rw', tables, async () => {
    const current = await table(kind).get(parsed.id)
    if (!current || JSON.stringify(current) !== JSON.stringify(parsed)) throw new Error('This record changed after the action.')
    const stamp = metadata()
    const restored = before ? { ...before, updatedAt: stamp.updatedAt } : { ...parsed, deletedAt: stamp.createdAt, updatedAt: stamp.updatedAt }
    await verifyReferences(restored)
    if (kind === 'accounts' && restored.deletedAt) await verifyAccountRemoval(restored.id)
    await table(kind).put(restored)
    await audit(kind, parsed.id, 'undo', current, restored)
  })
}

export function mutate<K extends BudgetTable>(kind: K, id: string | undefined, operation: string,
  change: (before: Records[K] | undefined, stamp: ReturnType<typeof metadata>) => Records[K] | undefined) {
  return db.transaction('rw', tables, async () => {
    const before = id ? await table(kind).get(id) : undefined
    if (id && !before) throw new Error('Record is unavailable.')
    const next = change(before, metadata())
    if (next) return persist(kind, before, next, operation)
  })
}

export function settleOccurrence(id: string, date: string, accountId: string, occursOn: (rule: string, start: string) => boolean) {
  return db.transaction('rw', tables, async () => {
    const expenses = table('expenses')
    const series = await expenses.get(id)
    if (!series || series.deletedAt || series.status !== 'planned' || !series.recurrenceRule || series.seriesId ||
      !occursOn(series.recurrenceRule, series.date)) throw new Error('Occurrence is unavailable.')
    const before = await expenses.where('[seriesId+date]').equals([id, date]).first()
    if (before?.status === 'paid' && !before.deletedAt) return
    const stamp = metadata()
    return persist('expenses', before, {
      ...series, ...stamp, id: before?.id ?? stamp.id, createdAt: before?.createdAt ?? stamp.createdAt,
      recurrenceRule: null, seriesId: id, status: 'paid', accountId, date,
    }, 'status')
  })
}

export async function savePreferences(values: Partial<Pick<Records['settings'], 'budgetView' | 'budgetConfigured' | 'budgetCards' | 'budgetHorizon'>>) {
  await db.transaction('rw', table('settings'), async () => {
    const store = table('settings')
    const existing = await store.get({ key: 'preferences' })
    if (!existing) throw new Error('Settings are still loading.')
    await store.put(recordSchemas.settings.parse({ ...existing, ...values, updatedAt: new Date().toISOString() }))
  })
}

export async function purgeBudget(before: string) {
  await db.transaction('rw', tables, async () => {
    for (const name of names) {
      await table(name).where('deletedAt').above('').filter(item => !!item.deletedAt && Date.parse(item.deletedAt) < Date.parse(before)).delete()
    }
  })
}

export async function seedBudget(data: BudgetData) {
  await db.transaction('rw', tables, async () => {
    const history: Records['budgetHistory'][] = []
    for (const name of names) {
      const records = data[name]
      await table(name).bulkAdd(records)
      for (const record of records) {
        const stamp = metadata()
        history.push({
          ...stamp, entityType: name, entityId: record.id, field: 'create',
          oldValue: null, newValue: json(record), changedAt: stamp.createdAt,
        })
      }
    }
    await table('budgetHistory').bulkAdd(history)
  })
}
