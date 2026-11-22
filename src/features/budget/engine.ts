import { shiftMonth } from '../calendar/dates'
import { addDays, expandDates, finiteOccurrences } from '../tasks/recurrence'
import type { BudgetData, Card, Period } from './model'
import type { Records } from '../../shared/db/schemas'

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export function parseMoney(value: string): number | undefined {
  const match = /^(-?)([0-9]{1,16})(?:\.([0-9]{1,2}))?$/.exec(value.trim())
  if (!match) return
  const cents = (BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'))) * (match[1] ? -1n : 1n)
  if (cents < BigInt(Number.MIN_SAFE_INTEGER) || cents > BigInt(Number.MAX_SAFE_INTEGER)) return
  return Number(cents)
}

export function moneyInputValue(value: number) {
  const amount = BigInt(value)
  const absolute = amount < 0n ? -amount : amount
  return (amount < 0n ? '-' : '') + absolute / 100n + '.' + String(absolute % 100n).padStart(2, '0')
}

export function formatMoney(amount: bigint | number) {
  const value = BigInt(amount)
  const absolute = value < 0n ? -value : value
  return (value < 0n ? '−' : '') + peso.formatToParts(absolute / 100n)
    .map(part => part.type === 'fraction' ? String(absolute % 100n).padStart(2, '0') : part.value).join('')
}

export function periodBounds(today: string, period: Period) {
  if (period === 'daily') return { from: today, through: today }
  if (period === 'yearly') return { from: today.slice(0, 4) + '-01-01', through: today.slice(0, 4) + '-12-31' }
  const from = today.slice(0, 7) + '-01'
  return { from, through: addDays(shiftMonth(from, 1), -1) }
}

type Expense = Records['expenses']
type Bounds = { from: string; through: string }
type ExpenseRow = Expense & { projected?: true }

export function activeBudget(data: BudgetData): BudgetData {
  return {
    accounts: data.accounts.filter(item => !item.deletedAt), incomes: data.incomes.filter(item => !item.deletedAt),
    expenses: data.expenses.filter(item => !item.deletedAt), transfers: data.transfers.filter(item => !item.deletedAt),
  }
}

const contains = (range: Bounds, date: string) => date >= range.from && date <= range.through
const sum = <T>(items: T[], amount: (item: T) => number) => items.reduce((total, item) => total + BigInt(amount(item)), 0n)
const isSeries = (item: Expense) => !!item.recurrenceRule && item.status === 'planned' && !item.seriesId
const slot = (seriesId: string, date: string) => seriesId + '/' + date

function substituted(expenses: Expense[]) {
  return new Set(expenses.flatMap(item => item.seriesId ? [slot(item.seriesId, item.date)] : []))
}

export function expensesWithin(expenses: Expense[], range: Bounds): ExpenseRow[] {
  const active = expenses.filter(item => !item.deletedAt)
  const overrides = substituted(active)
  return active.flatMap<ExpenseRow>(item => {
    if (!isSeries(item)) return contains(range, item.date) ? [item] : []
    return expandDates(item.recurrenceRule, item.date, range.from, range.through)
      .filter(date => !overrides.has(slot(item.id, date)))
      .map(date => ({ ...item, date, projected: true }))
  })
}

function allPlanned(expenses: Expense[]) {
  const overrides = substituted(expenses)
  let total = 0n
  for (const item of expenses) {
    if (item.status !== 'planned') continue
    if (!isSeries(item) || !item.amount) { total += BigInt(item.amount); continue }
    const dates = finiteOccurrences(item.recurrenceRule!, item.date)
    if (!dates) return null
    const count = dates.filter(date => !overrides.has(slot(item.id, date))).length
    total += BigInt(item.amount) * BigInt(count)
  }
  return total
}

export function periodTotals(data: BudgetData, bounds: Bounds) {
  const incomes = data.incomes.filter(item => !item.deletedAt && contains(bounds, item.expectedDate))
  const expenses = expensesWithin(data.expenses, bounds)
  const received = sum(incomes.filter(item => item.status === 'received'), item => item.amount)
  const expected = sum(incomes.filter(item => item.status === 'expected'), item => item.amount)
  const paid = sum(expenses.filter(item => item.status === 'paid'), item => item.amount)
  const planned = sum(expenses.filter(item => item.status === 'planned'), item => item.amount)
  return { received, expected, paid, planned, net: received + expected - paid - planned }
}

const daysBetween = (start: string, end: string) =>
  (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86_400_000

function floorDivide(value: bigint, days: number) {
  const denominator = BigInt(Math.max(1, days))
  return value / denominator - (value < 0n && value % denominator !== 0n ? 1n : 0n)
}

export function budgetEngine(input: BudgetData, today: string, period: Period, horizon: 'month' | 'sahod' = 'month') {
  const data = activeBudget(input)
  const balances = new Map(data.accounts.map(item => [item.id, BigInt(item.openingBalance)]))
  function adjust(id: string, cents: bigint) {
    const previous = balances.get(id)
    if (previous !== undefined) balances.set(id, previous + cents)
  }
  for (const item of data.incomes) if (item.status === 'received') adjust(item.accountId, BigInt(item.amount))
  for (const item of data.expenses) if (item.status === 'paid') adjust(item.accountId, -BigInt(item.amount))
  for (const item of data.transfers) {
    if (!balances.has(item.fromAccountId) || !balances.has(item.toAccountId)) continue
    adjust(item.fromAccountId, -BigInt(item.amount))
    adjust(item.toAccountId, BigInt(item.amount))
  }
  const money = [...balances.values()].reduce((total, value) => total + value, 0n)
  const expected = data.incomes.filter(item => item.status === 'expected')
  const income = sum(expected, item => item.amount)
  const planned = allPlanned(data.expenses)
  const month = periodBounds(today, 'monthly')
  const totals = periodTotals(data, month)
  const leftMonth = money + totals.expected - totals.planned
  const sahod = horizon === 'sahod' ? expected.filter(item => item.source.toLowerCase() === 'sahod' && item.expectedDate >= today)
    .map(item => item.expectedDate).sort()[0] : undefined
  const days = sahod ? daysBetween(today, sahod) : daysBetween(today, month.through) + 1
  const cards: Record<Card['key'], bigint | null> = {
    money, income, available: money + income, paid: sum(data.expenses.filter(item => item.status === 'paid'), item => item.amount),
    planned, leftMonth, leftOverall: planned === null ? null : money + income - planned,
    netMonth: totals.net, safe: floorDivide(leftMonth, days),
  }
  return { balances, cards, totals: period === 'monthly' ? totals : periodTotals(data, periodBounds(today, period)) }
}

export const categoryKey = (name: string) => name.trim().toLowerCase()

export function spendingByCategory(data: BudgetData, month: string) {
  const totals = new Map<string, { category: string; paid: bigint; planned: bigint }>()
  for (const item of expensesWithin(data.expenses, periodBounds(month, 'monthly'))) {
    const key = categoryKey(item.category)
    const row = totals.get(key) ?? { category: item.category, paid: 0n, planned: 0n }
    row[item.status] += BigInt(item.amount)
    totals.set(key, row)
  }
  return totals
}

export function categoryProgress(limit: Records['categoryBudgets'], spending: ReturnType<typeof spendingByCategory>) {
  const { paid, planned } = spending.get(limit.categoryKey) ?? { paid: 0n, planned: 0n }
  const used = paid + planned
  const cap = BigInt(limit.limit)
  return { paid, planned, used, status: used > cap ? 'over' : used * 5n >= cap * 4n ? 'near' : 'within',
    progress: Number(used > cap ? 100n : used * 100n / cap) } as const
}

export function debtProgress(debt: Records['debts'], data: Pick<BudgetData, 'incomes' | 'expenses' | 'transfers'>) {
  const ledger = debt.direction === 'owed' ? data.incomes.filter(item => item.status === 'received')
    : debt.direction === 'internal' ? data.transfers : data.expenses.filter(item => item.status === 'paid')
  const payments = ledger.filter(item => !item.deletedAt && item.debtId === debt.id)
  const paid = sum(payments, item => item.amount)
  const remaining = BigInt(debt.amount) - paid
  return { paid, remaining, status: remaining <= 0n ? 'settled' : paid > 0n ? 'partial' : 'open', payments } as const
}

export function goalProgress(goal: Records['goals'], transfers: BudgetData['transfers'], balance: bigint, today: string) {
  const target = BigInt(goal.target)
  const remaining = target - balance
  const recent = transfers.filter(item => !item.deletedAt && item.date >= addDays(today, -29) && item.date <= today)
  const rate = sum(recent.filter(item => item.toAccountId === goal.accountId), item => item.amount)
    - sum(recent.filter(item => item.fromAccountId === goal.accountId), item => item.amount)
  const estimatedDays = remaining > 0n && rate > 0n ? (remaining * 30n + rate - 1n) / rate : null
  const projected = remaining <= 0n ? undefined : estimatedDays !== null && estimatedDays <= 36525n
    ? addDays(today, Number(estimatedDays)) : undefined
  const progress = balance <= 0n ? 0 : Number(balance >= target ? 100n : balance * 100n / target)
  return { remaining, projected, progress }
}

export function previewPurchase(data: BudgetData, date: string, amount: number, today: string) {
  const before = budgetEngine(data, today, 'monthly').cards
  const after = budgetEngine({ ...data, expenses: [...data.expenses, {
    id: 'preview', createdAt: '', updatedAt: '', deletedAt: null, date, amount,
    status: 'planned', category: 'Preview', accountId: '', recurrenceRule: null,
  }] }, today, 'monthly').cards
  return { before: { month: before.leftMonth, overall: before.leftOverall },
    after: { month: after.leftMonth, overall: after.leftOverall } }
}

export function monthlySummary(data: BudgetData, month: string, today: string) {
  const bounds = periodBounds(month, 'monthly')
  const through = bounds.through > today ? today : bounds.through
  const settled = activeBudget(data)
  const dated = {
    ...settled,
    incomes: settled.incomes.filter(item => item.status === 'received' && item.expectedDate <= through),
    expenses: settled.expenses.filter(item => item.status === 'paid' && item.date <= through),
    transfers: settled.transfers.filter(item => item.date <= through),
  }
  return { ...periodTotals(data, bounds), balance: budgetEngine(dated, through, 'monthly').cards.money ?? 0n }
}

export function chartData(data: BudgetData, month: string, today: string) {
  const categories = [...spendingByCategory(data, month).values()].sort((a, b) => a.category.localeCompare(b.category))
  const trend = Array.from({ length: 6 }, (_, index) => {
    const date = shiftMonth(month, index - 5)
    return { month: date.slice(0, 7), ...monthlySummary(data, date, today) }
  })
  return { categories, trend }
}
