import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocalClock } from '../calendar/useCalendarData'
import { localDate } from '../tasks/recurrence'
import { Amount } from './BudgetCards'
import { chartData, monthlySummary } from './engine'
import { useBudget } from './useBudget'
import { useSummaryMonth } from './useExtras'
import './budget.css'

const BudgetCharts = lazy(() => import('./BudgetCharts').then(module => ({ default: module.BudgetCharts })))

export function MonthlySummary() {
  const today = localDate(useLocalClock())
  const { data, error } = useBudget()
  const [showCharts, setShowCharts] = useState(false)
  const { month, select } = useSummaryMonth(today)
  const rows = useMemo(() => data ? chartData(data, month, today) : undefined, [data, month, today])
  const summary = useMemo(() => data ? monthlySummary(data, month, today) : undefined, [data, month, today])
  if (error) return <p role="alert">Could not load the monthly summary.</p>
  if (!rows || !summary) return <p role="status">Loading monthly summary…</p>
  return <div className="planner-view budget-view">
    <div className="task-actions"><Link className="secondary" to="/budget">Back to Budget</Link></div>
    <section className="planner-card">
      <div className="budget-controls">
        <label>Month<input type="month" max={today.slice(0, 7)} value={month.slice(0, 7)} onChange={event => select(event.target.value)} /></label>
      </div>
      <dl className="budget-totals">
        <div><dt>Received income</dt><dd><Amount value={summary.received} /></dd></div>
        <div><dt>Expected income</dt><dd><Amount value={summary.expected} /></dd></div>
        <div><dt>Paid expenses</dt><dd><Amount value={summary.paid} /></dd></div>
        <div><dt>Planned expenses</dt><dd><Amount value={summary.planned} /></dd></div>
        <div><dt>Net this month</dt><dd><Amount value={summary.net} /></dd></div>
        <div><dt>{month.slice(0, 7) === today.slice(0, 7) ? 'Balance through today' : 'Month-end balance'}</dt><dd><Amount value={summary.balance} /></dd></div>
      </dl>
    </section>
    <section className="planner-card">
      <h2>Spending by category</h2>
      {rows.categories.length ? <div className="budget-table"><table>
        <caption>Expenses for {month.slice(0, 7)}</caption><thead><tr><th scope="col">Category</th><th scope="col">Paid</th><th scope="col">Planned</th></tr></thead>
        <tbody>{rows.categories.map(row => <tr key={row.category}><th scope="row">{row.category}</th><td><Amount value={row.paid} /></td><td><Amount value={row.planned} /></td></tr>)}</tbody>
      </table></div> : <p>No expenses in this month.</p>}
      <h2>Six-month trend</h2>
      <div className="budget-table"><table>
        <caption>Received income, paid expenses, and balances</caption><thead><tr><th scope="col">Month</th><th scope="col">Income received</th><th scope="col">Expenses paid</th><th scope="col">Balance</th></tr></thead>
        <tbody>{rows.trend.map(row => <tr key={row.month}><th scope="row">{row.month}</th><td><Amount value={row.received} /></td><td><Amount value={row.paid} /></td><td><Amount value={row.balance} /></td></tr>)}</tbody>
      </table></div>
      <button className="secondary" type="button" aria-expanded={showCharts} onClick={() => setShowCharts(!showCharts)}>{showCharts ? 'Hide charts' : 'Show charts'}</button>
      {showCharts && <Suspense fallback={<p role="status">Loading charts…</p>}><BudgetCharts data={rows} /></Suspense>}
    </section>
  </div>
}
