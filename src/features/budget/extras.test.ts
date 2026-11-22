import 'fake-indexeddb/auto'
import { afterEach, expect, it } from 'vitest'
import { db, table } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import { budgetEngine, categoryProgress, chartData, debtProgress, goalProgress, spendingByCategory } from './engine'
import { csvCell, transactionCsv } from './csv'
import { archiveExtra, makeMovement, purchasePreview, saveExtra } from './extraService'
import { readBudget } from './repository'
import { saveBudget, setDeleted, settleBudget } from './service'
import { defaultRepeat, encodeRepeat } from '../tasks/recurrence'
import { budgetDueWindow } from './due'

const today = '2024-02-29'
const account = () => ({ ...metadata(), name: 'Cash', type: 'cash' as const, openingBalance: 10000, color: 'rose', icon: 'budget-day' })
afterEach(async () => { await Promise.all(db.tables.map(store => store.clear())) })

it('combines paid and planned category occurrences and identifies near and over limits', async () => {
  const wallet = account()
  await table('accounts').add(wallet)
  await saveExtra('categoryBudgets', { category: '  Food ', limit: '20' })
  await expect(saveExtra('categoryBudgets', { category: 'FOOD', limit: '5' })).rejects.toThrow('already has')
  const rule = encodeRepeat({ ...defaultRepeat, mode: 'daily', count: 3 }, '2024-02-28', 1)
  const series = { ...metadata(), date: '2024-02-28', amount: 800, category: 'food', accountId: wallet.id,
    status: 'planned' as const, recurrenceRule: rule }
  await table('expenses').put(series)
  await settleBudget('expenses', series.id, wallet.id, today)
  const data = await readBudget()
  const spending = spendingByCategory(data, today)
  expect(categoryProgress(data.categoryBudgets[0], spending)).toMatchObject({ paid: 800n, planned: 800n, progress: 80, status: 'near' })
  expect(categoryProgress({ ...data.categoryBudgets[0], limit: 1500 }, spending).status).toBe('over')
})

it('contributes by transferring between own accounts and projects the finish from recent transfers', async () => {
  const wallet = account()
  await table('accounts').add(wallet)
  await saveExtra('goals', { name: 'Laptop', target: '100', targetDate: '2024-05-01' })
  let data = await readBudget()
  const goal = data.goals[0]
  const undo = await makeMovement('goals', { recordId: goal.id, accountId: wallet.id, amount: '25', date: today })
  data = await readBudget()
  const computed = budgetEngine(data, today, 'monthly')
  expect(computed.cards).toMatchObject({ money: 10000n, paid: 0n, income: 0n })
  expect(computed.balances.get(wallet.id)).toBe(7500n)
  expect(goalProgress(goal, data.transfers, computed.balances.get(goal.accountId)!, today))
    .toMatchObject({ remaining: 7500n, progress: 25, projected: '2024-05-29' })
  await undo()
  data = await readBudget()
  expect(goalProgress(goal, data.transfers, 0n, today)).toMatchObject({ progress: 0, projected: undefined })
})

it('posts each utang direction correctly, prevents overpayment and supports partial-payment Undo', async () => {
  const wallet = account()
  await table('accounts').add(wallet)
  await saveExtra('debts', { person: 'Lina', amount: '30', direction: 'owe', dueDate: today })
  await saveExtra('debts', { person: 'Mia', amount: '20', direction: 'owed', dueDate: today })
  const debts = (await readBudget()).debts
  const lina = debts.find(item => item.person === 'Lina')!
  const mia = debts.find(item => item.person === 'Mia')!
  const payment = { recordId: lina.id, accountId: wallet.id, amount: '12.50', date: today }
  const undo = await makeMovement('debts', payment)
  await makeMovement('debts', { ...payment, recordId: mia.id, amount: '20' })
  await expect(makeMovement('debts', { ...payment, amount: '17.51' })).rejects.toThrow('exceeds')
  await expect(archiveExtra('debts', lina.id, true)).rejects.toThrow('linked payments')
  let data = await readBudget()
  expect(debtProgress(lina, data)).toMatchObject({ status: 'partial', paid: 1250n, remaining: 1750n })
  expect(debtProgress(mia, data).status).toBe('settled')
  expect(budgetEngine(data, today, 'monthly').cards.money).toBe(10750n)
  await undo()
  data = await readBudget()
  expect(debtProgress(lina, data).status).toBe('open')
  expect(budgetEngine(data, today, 'monthly').cards.money).toBe(12000n)
  const paymentHistory = (await table('budgetHistory').toArray()).filter(item => item.entityType === 'expenses')
  expect(paymentHistory.map(item => item.field).sort()).toEqual(['create', 'undo'])
})

it('previews purchases on both horizons without persisting any transaction or history', async () => {
  await table('accounts').add(account())
  const before = await readBudget()
  expect(purchasePreview(before, { date: today, amount: '25' }, today))
    .toEqual({ before: { month: 10000n, overall: 10000n }, after: { month: 7500n, overall: 7500n } })
  expect(purchasePreview(before, { date: '2024-03-01', amount: '25' }, today).after)
    .toEqual({ month: 10000n, overall: 7500n })
  expect(await readBudget()).toEqual(before)
  expect(await table('budgetHistory').count()).toBe(0)
})

it('settles an internal utang as a linked transfer without changing cash or period net', async () => {
  const cash = account()
  const online = { ...account(), name: 'Online', openingBalance: 0 }
  await table('accounts').bulkAdd([cash, online])
  await saveExtra('debts', { person: 'Internal advance', direction: 'internal', amount: '10', dueDate: today,
    fromAccountId: cash.id, toAccountId: online.id })
  const debt = (await readBudget()).debts[0]
  const payment = { recordId: debt.id, accountId: cash.id, date: today, amount: '4' }
  await expect(makeMovement('debts', { ...payment, accountId: online.id })).rejects.toThrow('linked')
  await makeMovement('debts', payment)
  const data = await readBudget()
  expect(debtProgress(debt, data).remaining).toBe(600n)
  const result = budgetEngine(data, today, 'monthly')
  expect(result.balances.get(online.id)).toBe(400n)
  expect(result.cards).toMatchObject({ money: 10000n, netMonth: 0n })
  expect(data.transfers[0].debtId).toBe(debt.id)
})

it('quotes CSV text and disarms formulas in categories, account names, and notes', () => {
  for (const text of ['=1+1', '+SUM(A1)', '-1+2', '@foo', ' \t=HYPERLINK("bad")', '\n=bad']) {
    expect(csvCell(text)).toBe('"\'' + text.replaceAll('"', '""') + '"')
  }
  expect(csvCell('A, "B"\nC')).toBe('"A, ""B""\nC"')
  const wallet = { ...account(), name: '=wallet' }
  const csv = transactionCsv({ accounts: [wallet], incomes: [], transfers: [], expenses: [
    { ...metadata(), amount: 299, category: 'Food', date: today, accountId: wallet.id, status: 'paid',
      recurrenceRule: null, notes: '@formula' },
  ] })
  expect(csv).toContain('"299","Food","\'=wallet"')
  expect(csv).toContain('"\'@formula"')
  expect(csv.endsWith('\r\n')).toBe(true)
})

it('builds chronological chart data with settled flows and balance baselines', () => {
  const wallet = account()
  const sample = {
    accounts: [wallet], transfers: [],
    incomes: [
      { ...metadata(), amount: 3000, source: 'sahod', expectedDate: '2024-01-01', status: 'received' as const, accountId: wallet.id },
      { ...metadata(), amount: 4000, source: 'sahod', expectedDate: today, status: 'expected' as const, accountId: wallet.id },
    ],
    expenses: [{ ...metadata(), amount: 1100, category: 'Food', date: today, status: 'paid' as const,
      accountId: wallet.id, recurrenceRule: null }],
  }
  const data = chartData(sample, today, today)
  expect(data.trend.map(row => row.month)).toEqual(['2023-09','2023-10','2023-11','2023-12','2024-01','2024-02'])
  expect(data.trend.at(-2)).toMatchObject({ received: 3000n, paid: 0n, balance: 13000n })
  expect(data.trend.at(-1)).toMatchObject({ received: 0n, expected: 4000n, paid: 1100n, balance: 11900n })
  expect(data.categories).toEqual([{ category: 'Food', paid: 1100n, planned: 0n }])
})

it('schedules recurring bills and unsettled debt, dropping only the paid occurrence and the settled debt', async () => {
  const wallet = account()
  await table('accounts').add(wallet)
  await saveBudget('expenses', { amount: '10', date: today, accountId: wallet.id, category: 'Power', notes: '',
    repeat: { ...defaultRepeat, mode: 'daily', count: 2 }, billReminder: 0 })
  await saveExtra('debts', { person: 'Lina', amount: '5', dueDate: today, direction: 'owe', dueReminder: 0 })
  const from = +new Date(today + 'T00:00:00')
  const through = +new Date('2024-03-01T23:59:59')
  const data = await readBudget()
  expect(budgetDueWindow(data, from, through)).toHaveLength(3)
  await settleBudget('expenses', data.expenses[0].id, wallet.id, today)
  await makeMovement('debts', { recordId: data.debts[0].id, accountId: wallet.id, amount: '5', date: today })
  const outstanding = budgetDueWindow(await readBudget(), from, through)
  expect(outstanding).toHaveLength(1)
  expect(outstanding[0].key).toContain('2024-03-01')
  await setDeleted('expenses', data.expenses[0].id, true)
  expect(budgetDueWindow(await readBudget(), from, through)).toEqual([])
})
