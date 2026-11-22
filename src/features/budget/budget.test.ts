import 'fake-indexeddb/auto'
import { afterEach, expect, it } from 'vitest'
import { db, table } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import { exportBackup } from '../../shared/db/backupRepository'
import { backupSchema } from '../../shared/db/schemas'
import { defaultRepeat, encodeRepeat } from '../tasks/recurrence'
import { budgetEngine, formatMoney, parseMoney, periodBounds } from './engine'
import type { BudgetData } from './model'
import { readBudget } from './repository'
import { saveBudget, setDeleted, settleBudget } from './service'

const today = '2024-02-28'
const account = (openingBalance = 10000) => ({
  ...metadata(), name: 'Wallet', type: 'cash' as const, color: 'rose', icon: 'budget-day', openingBalance,
})
const fixtures = (): BudgetData => ({ accounts: [account()], incomes: [], expenses: [], transfers: [] })
afterEach(async () => { await Promise.all(db.tables.map(target => target.clear())) })

it('parses and formats centavos without fractional arithmetic and handles safe integer bounds', () => {
  expect(parseMoney('0.10')).toBe(10)
  expect(parseMoney(' -23.4 ')).toBe(-2340)
  expect(parseMoney('0.005')).toBeUndefined()
  expect(parseMoney('1e3')).toBeUndefined()
  expect(parseMoney('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER)
  expect(parseMoney('90071992547409.92')).toBeUndefined()
  expect(formatMoney(9007199254740993n)).toBe('₱90,071,992,547,409.93')
  expect(formatMoney(-101n)).toBe('−₱1.01')
})

it('uses inclusive daily, monthly, yearly dates across leap day and year boundaries', () => {
  expect(periodBounds(today, 'daily')).toEqual({ from: today, through: today })
  expect(periodBounds(today, 'monthly').through).toBe('2024-02-29')
  expect(periodBounds('2025-02-20', 'monthly').through).toBe('2025-02-28')
  expect(periodBounds('2024-12-31', 'monthly').through).toBe('2024-12-31')
  expect(periodBounds('2025-01-01', 'yearly')).toEqual({ from: '2025-01-01', through: '2025-12-31' })
})

it('calculates every quick card without double-counting and keeps internal transfers out of totals', () => {
  const data = fixtures()
  const cash = data.accounts[0]
  const online = account(1000)
  data.accounts.push(online)
  data.incomes.push(
    { ...metadata(), amount: 4000, source: 'sahod', expectedDate: '2024-02-01', status: 'received', accountId: cash.id },
    { ...metadata(), amount: 2000, source: 'sahod', expectedDate: '2024-02-29', status: 'expected', accountId: cash.id },
    { ...metadata(), amount: 2500, source: 'gift', expectedDate: '2024-03-01', status: 'expected', accountId: cash.id },
  )
  data.expenses.push(
    { ...metadata(), amount: 1000, category: 'Food', date: today, status: 'paid', accountId: cash.id, recurrenceRule: null },
    { ...metadata(), amount: 600, category: 'Food', date: '2024-02-29', status: 'planned', accountId: cash.id, recurrenceRule: null },
    { ...metadata(), amount: 400, category: 'Bills', date: '2024-03-01', status: 'planned', accountId: cash.id, recurrenceRule: null },
  )
  data.transfers.push({ ...metadata(), amount: 3000, date: today, fromAccountId: cash.id, toAccountId: online.id })
  const { balances, cards, totals } = budgetEngine(data, today, 'monthly')
  expect([...balances.values()]).toEqual([10000n, 4000n])
  expect(cards).toEqual({ money: 14000n, income: 4500n, available: 18500n, paid: 1000n, planned: 1000n,
    leftMonth: 15400n, leftOverall: 17500n, netMonth: 4400n, safe: 7700n })
  expect(totals).toMatchObject({ received: 4000n, expected: 2000n, paid: 1000n, planned: 600n })
  expect(budgetEngine(data, today, 'daily').totals.net).toBe(-1000n)
  expect(budgetEngine(data, today, 'yearly').totals.net).toBe(6500n)
  expect(budgetEngine(data, today, 'monthly', 'sahod').cards.safe).toBe(15400n)
})

it('protects negative rounding and exact aggregation above the per-record safe integer limit', () => {
  const data = fixtures()
  data.accounts[0].openingBalance = -3
  expect(budgetEngine(data, today, 'monthly').cards.safe).toBe(-2n)
  expect(budgetEngine(data, today, 'monthly', 'sahod').cards.safe).toBe(-2n)
  data.accounts[0].openingBalance = Number.MAX_SAFE_INTEGER
  data.accounts.push(account(Number.MAX_SAFE_INTEGER))
  expect(budgetEngine(data, today, 'monthly').cards.money).toBe(18014398509481982n)
})

it('replaces a paid repeat occurrence, includes finite repeats overall, and shows endless totals as open-ended', () => {
  const data = fixtures()
  const accountId = data.accounts[0].id
  const series = { ...metadata(), status: 'planned' as const, amount: 100, category: 'Food',
    accountId, date: today, recurrenceRule: encodeRepeat({ ...defaultRepeat, mode: 'daily', count: 3 }, today, 1) }
  data.expenses.push(series, { ...series, ...metadata(), status: 'paid', recurrenceRule: null, seriesId: series.id, date: '2024-02-29' })
  const result = budgetEngine(data, today, 'monthly')
  expect(result.cards).toMatchObject({ money: 9900n, paid: 100n, planned: 200n, leftMonth: 9800n, leftOverall: 9700n, netMonth: -200n })
  series.recurrenceRule = encodeRepeat({ ...defaultRepeat, mode: 'daily' }, today, 1)
  expect(budgetEngine(data, today, 'monthly').cards.leftOverall).toBeNull()
})

it('audits create, edit, settle once, undo, delete and restore, and includes transfers in backups', async () => {
  await saveBudget('accounts', { name: 'Wallet', type: 'cash', openingBalance: '100.00', color: 'rose', icon: 'budget-day' })
  await saveBudget('accounts', { name: 'Online', type: 'online', openingBalance: '0', color: 'sky', icon: 'home' })
  const [cash, online] = (await readBudget()).accounts.sort((a, b) => b.openingBalance - a.openingBalance)
  const input = { amount: '15.25', category: 'Food', date: today, accountId: cash.id, notes: '', repeat: defaultRepeat }
  await saveBudget('expenses', input)
  const expense = (await readBudget()).expenses[0]
  await saveBudget('expenses', { ...input, notes: 'Lunch' }, expense.id)
  const undo = await settleBudget('expenses', expense.id, cash.id)
  expect(await settleBudget('expenses', expense.id, online.id)).toBeUndefined()
  expect((await table('budgetHistory').toArray()).filter(item => item.field === 'status')).toHaveLength(1)
  expect(budgetEngine(await readBudget(), today, 'daily').cards.money).toBe(8475n)
  await undo!()
  const restored = budgetEngine(await readBudget(), today, 'daily').cards
  expect(restored).toMatchObject({ money: 10000n, leftMonth: 8475n })
  await setDeleted('expenses', expense.id, true)
  expect(budgetEngine(await readBudget(), today, 'daily').cards.leftMonth).toBe(10000n)
  await setDeleted('expenses', expense.id, false)
  await saveBudget('transfers', { date: today, amount: '10', fromAccountId: cash.id, toAccountId: online.id })
  expect((await exportBackup()).data.transfers).toHaveLength(1)
  const old = await exportBackup()
  const { transfers, ...legacy } = old.data
  expect(transfers).toHaveLength(1)
  expect(backupSchema.parse({ ...old, data: legacy }).data.transfers).toEqual([])
  const fields = (await table('budgetHistory').toArray()).filter(item => item.entityId === expense.id).map(item => item.field)
  expect(fields.sort()).toEqual(['create', 'delete', 'notes', 'restore', 'status', 'undo'])
})

it('pays and undoes one repeat and protects accounts with active transactions', async () => {
  const wallet = account()
  await table('accounts').add(wallet)
  await saveBudget('expenses', { amount: '10', category: 'Food', date: today, accountId: wallet.id, notes: '',
    repeat: { ...defaultRepeat, mode: 'daily', count: 2 } })
  const [series] = (await readBudget()).expenses
  const undo = await settleBudget('expenses', series.id, wallet.id, today)
  expect(await settleBudget('expenses', series.id, wallet.id, today)).toBeUndefined()
  expect(budgetEngine(await readBudget(), today, 'monthly').cards.planned).toBe(1000n)
  await undo!()
  expect(budgetEngine(await readBudget(), today, 'monthly').cards.planned).toBe(2000n)
  await expect(setDeleted('accounts', wallet.id, true)).rejects.toThrow('transactions first')
})

it('receives income once in the chosen account and credits it out of the forecast', async () => {
  const wallet = account()
  const online = account(0)
  await table('accounts').bulkAdd([wallet, online])
  await saveBudget('incomes', { amount: '10.01', source: 'sahod', expectedDate: today, accountId: wallet.id })
  const [income] = (await readBudget()).incomes
  const undo = await settleBudget('incomes', income.id, online.id)
  await settleBudget('incomes', income.id, wallet.id)
  const result = budgetEngine(await readBudget(), today, 'monthly')
  expect(result.balances.get(online.id)).toBe(1001n)
  expect(result.cards).toMatchObject({ money: 11001n, income: 0n, leftMonth: 11001n })
  expect(await table('budgetHistory').filter(item => item.field === 'status').count()).toBe(1)
  await undo!()
  expect(budgetEngine(await readBudget(), today, 'monthly').cards).toMatchObject({ money: 10000n, income: 1001n, leftMonth: 11001n })
})
