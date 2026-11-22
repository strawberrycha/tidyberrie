import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { activeBudget, budgetEngine, expensesWithin, formatMoney } from '../budget/engine'
import { BudgetEditor } from '../budget/BudgetEditor'
import { useBudget, useBudgetActions } from '../budget/useBudget'
import { addDays } from '../tasks/recurrence'
import { dateLabel } from '../calendar/dates'
import { useTheme } from '../../shared/theme/ThemeProvider'
import '../tasks/tasks.css'

export function useHomeBudget(today: string, selected: string) {
  const { data, error } = useBudget()
  const model = useMemo(() => {
    if (!data?.preferences?.budgetConfigured) return undefined
    const bills = (from: string, through: string) => expensesWithin(data.expenses, { from, through })
      .filter(bill => bill.status === 'planned' && !bill.deletedAt && bill.billReminder !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date))
    return {
      cards: budgetEngine(data, today, data.preferences.budgetView, data.preferences.budgetHorizon).cards,
      next: bills(today, addDays(today, 365))[0],
      upcoming: bills(addDays(selected, 1), addDays(selected, 3)),
    }
  }, [data, today, selected])
  return { data, error, model }
}

export function HomeBudgetSummary({ today, budget, openBill, hidden, toggle }: {
  today: string; budget: ReturnType<typeof useHomeBudget>; openBill: (id: string) => void;
  hidden: boolean; toggle: () => void
}) {
  const { data, error, model } = budget
  const show = (amount: bigint | number | null) => amount === null ? 'Unavailable' : hidden ? '₱ ••••' : formatMoney(amount)
  const EyeIcon = hidden ? EyeOff : Eye
  return <section className="home-card">
    <h2>Budget</h2>
    {error && <p role="alert">Could not load Budget.</p>}
    {!data && !error && <p role="status">Loading Budget…</p>}
    {data && !model && <Link className="secondary" to="/budget">Set up your budget</Link>}
    {model && <>
      <button type="button" className="icon-button" onClick={toggle} aria-label={hidden ? 'Show amounts' : 'Hide amounts'}><EyeIcon aria-hidden size={20} /></button>
      <dl className="home-budget-amounts">
        <div><dt>Left this month</dt><dd>{show(model.cards.leftMonth)}</dd></div>
        <div><dt>Safe to spend today</dt><dd>{show(model.cards.safe)}</dd></div>
      </dl>
      {model.next && <button className="secondary" onClick={() => openBill(model.next.id)}>
        {model.next.category} · {distance(today, model.next.date)} · {show(model.next.amount)}
      </button>}
    </>}
  </section>
}

function distance(today: string, date: string) {
  const days = (Date.parse(date) - Date.parse(today)) / 86_400_000
  return days === 0 ? 'Today' : days === 1 ? 'In 1 day' : 'In ' + days + ' days'
}

export function BudgetQuickEditor({ selection, data, today, close }: {
  selection: { kind: 'expenses' | 'incomes'; id?: string }; data: ReturnType<typeof useHomeBudget>['data'];
  today: string; close: () => void
}) {
  const actions = useBudgetActions()
  const { preferences } = useTheme()
  const [ready] = useState(() => data && activeBudget(data).accounts)
  if (!ready?.length) return <Link className="secondary" to="/budget" onClick={close}>Set up your budget</Link>
  return <BudgetEditor kind={selection.kind} row={data?.[selection.kind].find(row => row.id === selection.id)}
    today={today} accounts={ready} actions={actions} week={preferences?.weekStart ?? 1} close={close} />
}

export function BillLine({ name, date, open }: { name: string; date: string; open: () => void }) {
  return <button type="button" className="home-upcoming" onClick={open}>
    <strong>{name}</strong><span>{dateLabel(date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
  </button>
}
