import type { Records } from '../../shared/db/schemas'

export type BudgetTable = 'accounts' | 'incomes' | 'expenses' | 'transfers'
export type BudgetData = Pick<{ [K in keyof Records]: Records[K][] }, BudgetTable>
export type Period = Records['settings']['budgetView']
export type Card = NonNullable<Records['settings']['budgetCards']>[number]
export type History = Records['budgetHistory']
export const kinds = { accounts: 'Account', incomes: 'Income', expenses: 'Expense', transfers: 'Transfer' } as const
export const sources = ['sahod', 'allowance', 'sales', 'gift', 'other'] as const
export const categories = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Other'] as const
export const periods = ['daily', 'monthly', 'yearly'] as const
export const cardDefinitions: Record<Card['key'], { label: string; explanation: string }> = {
  leftMonth: { label: 'Left this month', explanation: 'Money now plus expected income due this month, minus unpaid expenses due this month.' },
  leftOverall: { label: 'Left overall', explanation: 'Money now plus all expected income, minus all unpaid expenses. Ongoing repeats without an end make this total open-ended.' },
  netMonth: { label: 'Net this month', explanation: 'All income this month minus all expenses this month, including settled and outstanding amounts.' },
  safe: { label: 'Safe to spend per day', explanation: 'Left this month divided by days remaining, including today, through month end or until the next expected sahod. Fractions of a centavo round down.' },
  money: { label: 'Money now', explanation: 'Opening balances plus received income, minus paid expenses. Internal transfers move money between accounts without changing this total.' },
  income: { label: 'Upcoming income', explanation: 'All income still marked expected, including any past-due amounts.' },
  available: { label: 'Now + upcoming', explanation: 'Money now plus all expected income.' },
  paid: { label: 'Expenses paid', explanation: 'All expenses already paid.' },
  planned: { label: 'Expenses planned', explanation: 'All unpaid expenses, including dated repeats. Ongoing repeats without an end make this total open-ended.' },
}
export const defaultCards: Card[] = (Object.keys(cardDefinitions) as Card['key'][]).map(key => ({
  key, label: cardDefinitions[key].label, color: key === 'leftMonth' ? 'berry' : 'rose',
  visible: true, home: key === 'leftMonth' || key === 'money',
}))
