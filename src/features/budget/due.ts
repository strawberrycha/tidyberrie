import type { Records } from '../../shared/db/schemas'
import { localDate } from '../tasks/recurrence'
import { debtProgress, expensesWithin } from './engine'
import type { BudgetData } from './model'
import type { Reminder } from '../reminders/window'

export function budgetDueWindow(data: BudgetData & { debts: Records['debts'][] }, from: number, through: number): Reminder[] {
  const reminders: Reminder[] = []
  function add(key: string, title: string, date: string, offset: number) {
    const at = +new Date(date + 'T09:00:00') - offset * 60000
    if (at >= from && at <= through) reminders.push({ key, title, at, sourceAt: at })
  }
  const fromDate = localDate(new Date(from))
  const throughDate = localDate(new Date(through + 86400000))
  for (const item of expensesWithin(data.expenses, { from: fromDate, through: throughDate })) {
    if (item.status === 'planned' && item.billReminder !== undefined) {
      add('bill:' + item.id + '/' + item.date + '/' + item.billReminder, 'Bill due · ' + item.category, item.date, item.billReminder)
    }
  }
  for (const debt of data.debts) {
    if (!debt.deletedAt && debt.dueReminder !== undefined && debtProgress(debt, data).remaining > 0n) {
      add('utang:' + debt.id + '/' + debt.dueDate + '/' + debt.dueReminder, 'Utang due · ' + debt.person, debt.dueDate, debt.dueReminder)
    }
  }
  return reminders
}
