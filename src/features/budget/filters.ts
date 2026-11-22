import type { BudgetData, BudgetTable, Period } from './model'
import type { Records } from '../../shared/db/schemas'
import { activeBudget, expensesWithin, periodBounds } from './engine'
import { addDays } from '../tasks/recurrence'

export type Listing = { kind: BudgetTable; row: Records[BudgetTable]; date?: string; title: string; projected?: true }
export type Filters = { range: string; status: string; account: string; category: string; search: string; kind: string }

export const defaultFilters: Filters = { range: 'period', status: '', account: '', category: '', search: '', kind: '' }

export function budgetList(input: BudgetData, filters: Filters, today: string, period: Period, trash: boolean) {
  const data = trash ? input : activeBudget(input)
  const bounds = filters.range === 'period' ? periodBounds(today, period)
    : { from: addDays(today, 1), through: addDays(today, 90) }
  const expenses = trash || filters.range === 'records' ? data.expenses : [
    ...expensesWithin(data.expenses, bounds),
    ...(filters.range === 'future' ? data.expenses.filter(item => !item.recurrenceRule && item.date > bounds.through) : []),
  ]
  const rows: Listing[] = [
    ...data.incomes.map((row): Listing => ({ kind: 'incomes', row, title: row.source, date: row.expectedDate })),
    ...expenses.map((row): Listing => ({ kind: 'expenses', row, title: row.category, date: row.date,
      projected: 'projected' in row && row.projected ? true : undefined })),
    ...data.transfers.map((row): Listing => ({ kind: 'transfers', row, title: 'Transfer', date: row.date })),
    ...(trash ? data.accounts.map((row): Listing => ({ kind: 'accounts', row, title: row.name })) : []),
  ]
  if (trash) return rows.filter(({ row }) => row.deletedAt).sort((a, b) => b.row.deletedAt!.localeCompare(a.row.deletedAt!))
  const names = new Map(data.accounts.map(account => [account.id, account.name]))
  const query = filters.search.trim().toLowerCase()
  return rows.filter(({ row, date, kind, title }) => {
    if (filters.kind && filters.kind !== kind) return false
    if (filters.range === 'period' && (date! < bounds.from || date! > bounds.through)) return false
    if (filters.range === 'future' && date! <= today) return false
    const accounts = 'accountId' in row ? [row.accountId]
      : 'fromAccountId' in row ? [row.fromAccountId, row.toAccountId] : []
    if (filters.account && !accounts.includes(filters.account)) return false
    if (filters.category && (!('category' in row) || row.category !== filters.category)) return false
    if (filters.status && (!('status' in row) ||
      (row.status === 'paid' || row.status === 'received') !== (filters.status === 'settled'))) return false
    return !query || [title, 'notes' in row ? row.notes : '', ...accounts.map(account => names.get(account))]
      .some(value => value?.toLowerCase().includes(query))
  }).sort((a, b) => (filters.range === 'future' ? a.date!.localeCompare(b.date!) : b.date!.localeCompare(a.date!)) ||
    a.title.localeCompare(b.title))
}
