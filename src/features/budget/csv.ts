import { activeBudget } from './engine'
import type { BudgetData } from './model'

export function csvCell(value: string | number) {
  let text = String(value)
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text)) text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}

export function transactionCsv(input: BudgetData) {
  const data = activeBudget(input)
  const accounts = new Map(data.accounts.map(account => [account.id, account.name]))
  const name = (id: string) => accounts.get(id) ?? id
  const rows: (string | number)[][] = [
    ...data.incomes.map(item => [item.expectedDate, 'Income', item.status, item.amount, item.source, name(item.accountId), '', '', item.id, item.debtId ?? '']),
    ...data.expenses.map(item => [item.date, item.recurrenceRule ? 'Expense series' : 'Expense', item.status, item.amount,
      item.category, name(item.accountId), '', item.notes ?? '', item.id, item.debtId ?? '']),
    ...data.transfers.map(item => [item.date, 'Transfer', '', item.amount, '', name(item.fromAccountId), name(item.toAccountId), '', item.id, item.debtId ?? '']),
  ]
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  return [['Date', 'Type', 'Status', 'Centavos', 'Source or category', 'Account', 'Destination', 'Notes', 'Record ID', 'Utang ID'], ...rows]
    .map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
