import { lazy, Suspense, useMemo, useState } from 'react'
import { Archive, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../shared/theme/ThemeProvider'
import { EmptyIllustration } from '../../shared/ui/EmptyState'
import { useLocalClock } from '../calendar/useCalendarData'
import { PlannerAddButton } from '../calendar/PlannerTasks'
import { localDate } from '../tasks/recurrence'
import { TaskDialog } from '../tasks/TaskDialog'
import { TaskIcon } from '../tasks/icons'
import { colors, icons } from '../tasks/input'
import { Amount, BudgetCards, CardEditor } from './BudgetCards'
import { AccountOptions, BudgetEditor } from './BudgetEditor'
import type { EditorRow } from './BudgetEditor'
import { activeBudget, budgetEngine } from './engine'
import { budgetList, defaultFilters } from './filters'
import type { Filters, Listing } from './filters'
import { defaultCards, kinds, periods } from './model'
import type { BudgetTable } from './model'
import { useBudget, useBudgetActions } from './useBudget'
import { useTransactionExport } from './useExtras'
import './budget.css'

const BudgetHistory = lazy(() => import('./BudgetHistory').then(module => ({ default: module.BudgetHistory })))
type Dialog =
  | { kind: 'pick' | 'cards' | 'history' }
  | { kind: 'edit'; table: BudgetTable; row?: EditorRow }
  | { kind: 'settle' | 'delete'; entry: Listing }

export function Budget() {
  const { data, error } = useBudget()
  const actions = useBudgetActions()
  const exportTransactions = useTransactionExport()
  const { preferences } = useTheme()
  const today = localDate(useLocalClock())
  const [dialog, setDialog] = useState<Dialog>()
  const [trash, setTrash] = useState(false)
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [limit, setLimit] = useState(25)
  const period = data?.preferences?.budgetView ?? 'monthly'
  const horizon = data?.preferences?.budgetHorizon ?? 'month'
  const cards = data?.preferences?.budgetCards ?? defaultCards
  const result = useMemo(() => data ? budgetEngine(data, today, period, horizon) : undefined, [data, today, period, horizon])
  const rows = useMemo(() => data ? budgetList(data, filters, today, period, trash) : [], [data, filters, today, period, trash])
  const active = useMemo(() => data ? activeBudget(data) : undefined, [data])
  const close = () => setDialog(undefined)

  if (error) return <p role="alert">Could not load the budget.</p>
  if (!data || !result || !active || !data.preferences) return <p role="status">Loading budget…</p>
  if (!data.preferences.budgetConfigured) return <section className="planner-card">
    <EmptyIllustration icon={Wallet} sticker="avatar-wallet" />
    <h2>How do you want to view your budget?</h2>
    <div className="task-actions">{periods.map(value => <button className="secondary budget-title" key={value} type="button" disabled={actions.busy}
      onClick={() => void actions.configure(value)}>{value}</button>)}</div>
  </section>

  const accountName = (id: string) => active.accounts.find(account => account.id === id)?.name ?? 'Unavailable account'
  const change = (key: keyof Filters, value: string) => { setFilters({ ...filters, [key]: value }); setLimit(25) }
  const flipTrash = () => { setTrash(!trash); setLimit(25) }
  return <div className="planner-view budget-view">
    <div className="task-actions">
      <button className="secondary" type="button" onClick={flipTrash}><Archive size={18} aria-hidden />{trash ? 'Back to Budget' : 'Budget Trash'}</button>
      {!trash && <button className="secondary" type="button" onClick={() => setDialog({ kind: 'history' })}>History</button>}
      {!trash && <>
        <Link className="secondary budget-link" to="/budget/extras">Category limits, goals &amp; utang</Link>
        <Link className="secondary budget-link" to="/budget/summary">Monthly summary</Link>
        <button className="secondary" type="button" onClick={() => exportTransactions(data)}>Export transactions as CSV</button>
      </>}
    </div>
    {!trash && <>
      <section className="planner-card">
        <div className="budget-controls">
          <label>Budget view<select value={period} onChange={event => { setLimit(25); void actions.configure(event.target.value) }} disabled={actions.busy}>
            {periods.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
          </select></label>
          <label>Safe-to-spend horizon<select value={horizon} disabled={actions.busy} onChange={event => void actions.horizon(event.target.value)}>
            <option value="month">Through month end</option><option value="sahod">Until next expected sahod</option>
          </select></label>
          <button className="secondary" type="button" onClick={() => setDialog({ kind: 'cards' })}>Customize cards</button>
        </div>
        <BudgetCards cards={cards} values={result.cards} />
      </section>
      <section className="planner-card">
        <h2 className="budget-title">{period} totals</h2>
        <dl className="budget-totals">{Object.entries(result.totals).map(([key, value]) => <div key={key}>
          <dt className="budget-title">{key}</dt><dd><Amount value={value} /></dd>
        </div>)}</dl>
      </section>
      <section className="planner-card">
        <h2>Accounts</h2>
        {active.accounts.length === 0 && <p>Add a cash or online account to get started.</p>}
        <ul className="budget-cards">{active.accounts.map(account => <li className={'planner-card budget-card task-color-' + (colors.find(color => color === account.color) ?? 'rose')} key={account.id}>
          <h3><TaskIcon name={icons.find(icon => icon === account.icon) ?? 'budget-day'} /> {account.name}</h3>
          <p>{account.type === 'cash' ? 'Cash on hand' : 'Online account'}</p>
          <Amount value={result.balances.get(account.id) ?? 0n} />
          <div className="task-actions">
            <button type="button" className="secondary" aria-label={'Edit ' + account.name} onClick={() => setDialog({ kind: 'edit', table: 'accounts', row: account })}>Edit</button>
            <button type="button" className="secondary" aria-label={'Delete ' + account.name} onClick={() => setDialog({
              kind: 'delete', entry: { kind: 'accounts', row: account, title: account.name },
            })}>Delete</button>
          </div>
        </li>)}</ul>
      </section>
    </>}
    <section className="planner-card">
      <h2>{trash ? 'Budget Trash' : 'Transactions'}</h2>
      {!trash && <div className="budget-controls">
        <label>Search<input type="search" value={filters.search} onChange={event => change('search', event.target.value)} /></label>
        <label>Dates<select value={filters.range} onChange={event => change('range', event.target.value)}>
          <option value="period">This period</option><option value="future">Future</option><option value="records">All records and recurring series</option>
        </select></label>
        <label>Type<select value={filters.kind} onChange={event => change('kind', event.target.value)}>
          <option value="">All types</option><option value="incomes">Income</option><option value="expenses">Expenses</option><option value="transfers">Transfers</option>
        </select></label>
        <label>Status<select value={filters.status} onChange={event => change('status', event.target.value)}>
          <option value="">Any status</option><option value="settled">Paid or received</option><option value="unsettled">Planned or expected</option>
        </select></label>
        <label>Account<select value={filters.account} onChange={event => change('account', event.target.value)}>
          <option value="">All accounts</option>{active.accounts.map(account => <option value={account.id} key={account.id}>{account.name}</option>)}
        </select></label>
        <label>Category<select value={filters.category} onChange={event => change('category', event.target.value)}>
          <option value="">All categories</option>{[...new Set(active.expenses.map(item => item.category))].sort().map(category => <option key={category}>{category}</option>)}
        </select></label>
      </div>}
      {!rows.length && <><EmptyIllustration icon={Wallet} sticker="avatar-wallet" /><p>{trash ? 'Budget Trash is empty.' : 'No transactions match this view.'}</p></>}
      {!!rows.length && <p role="status">Showing {Math.min(limit, rows.length)} of {rows.length} records</p>}
      <ul className="budget-rows">{rows.slice(0, limit).map(entry => {
        const { row, kind, date, title, projected } = entry
        const recurring = 'recurrenceRule' in row && !!row.recurrenceRule
        const settlement = 'status' in row && (row.status === 'planned' || row.status === 'expected')
        return <li className="planner-card budget-row" key={kind + row.id + (projected ? date : '')}>
          <div><h3>{title}</h3><p className="budget-title">{kinds[kind]}{date ? ' · ' + date : ''}{'status' in row ? ' · ' + row.status : ''}</p></div>
          {'amount' in row && <Amount value={row.amount} />}
          {'accountId' in row && <p>{accountName(row.accountId)}</p>}
          {'fromAccountId' in row && <p>{accountName(row.fromAccountId)} → {accountName(row.toAccountId)}</p>}
          {'notes' in row && row.notes && <p>{row.notes}</p>}
          {recurring && <p>{projected ? 'Recurring occurrence' : 'Recurring series'}</p>}
          <div className="task-actions">
            {trash ? <button className="secondary" type="button" disabled={actions.busy} onClick={() => void actions.remove(kind, row.id, false)}>Restore</button> : <>
              {settlement && (!recurring || projected) && <button className="secondary" type="button" disabled={actions.busy}
                onClick={() => setDialog({ kind: 'settle', entry })}>{kind === 'incomes' ? 'Mark received' : 'Mark paid'}</button>}
              <button className="secondary" type="button" onClick={() => setDialog({
                kind: 'edit', table: kind, row: projected ? data.expenses.find(item => item.id === row.id) : row,
              })}>{recurring ? 'Edit series' : 'Edit'}</button>
              <button className="secondary" type="button" onClick={() => setDialog({ kind: 'delete', entry })}>{recurring ? 'Delete series' : 'Delete'}</button>
            </>}
          </div>
        </li>
      })}</ul>
      {rows.length > limit && <button className="secondary" type="button" onClick={() => setLimit(limit + 25)}>Show more transactions</button>}
    </section>
    {!trash && <>
      {import.meta.env.DEV && <button className="secondary" type="button" disabled={actions.busy} onClick={() => void actions.seed(today)}>Development: seed 2,000 transactions</button>}
      <PlannerAddButton label="Add budget record" open={() => setDialog({ kind: 'pick' })} />
    </>}
    {dialog?.kind === 'pick' && <TaskDialog title="Add budget record" close={close}>
      <div className="task-actions">{(Object.keys(kinds) as BudgetTable[]).map(kind =>
        <button type="button" className="secondary" key={kind} disabled={kind !== 'accounts' && active.accounts.length < (kind === 'transfers' ? 2 : 1)}
          onClick={() => setDialog({ kind: 'edit', table: kind })}>{kinds[kind]}</button>)}</div>
      {!active.accounts.length && <p>Create an account first.</p>}
    </TaskDialog>}
    {dialog?.kind === 'edit' && <BudgetEditor kind={dialog.table} row={dialog.row} today={today} accounts={active.accounts}
      week={preferences?.weekStart ?? 1} actions={actions} close={close} />}
    {dialog?.kind === 'cards' && <CardEditor initial={cards} busy={actions.busy} close={close} save={value => void actions.updateCards(value, close)} />}
    {dialog?.kind === 'history' && <TaskDialog title="Budget history" close={close}><Suspense fallback={<p>Loading history…</p>}><BudgetHistory /></Suspense></TaskDialog>}
    {dialog?.kind === 'delete' && <TaskDialog title="Move to Budget Trash?" close={close}>
      <p>{dialog.entry.title}</p>
      <div className="task-actions">
        <button data-first-field className="secondary" type="button" onClick={close}>Cancel</button>
        <button className="primary" type="button" disabled={actions.busy} onClick={() => void actions.remove(dialog.entry.kind, dialog.entry.row.id, true, close)}>Move to Trash</button>
      </div>
    </TaskDialog>}
    {dialog?.kind === 'settle' && <Settle entry={dialog.entry} accounts={active.accounts} actions={actions} close={close} />}
  </div>
}

function Settle({ entry, accounts, actions, close }: {
  entry: Listing; accounts: ReturnType<typeof activeBudget>['accounts']; actions: ReturnType<typeof useBudgetActions>; close: () => void
}) {
  const [id, setId] = useState('accountId' in entry.row ? entry.row.accountId : '')
  const kind = entry.kind === 'incomes' ? 'incomes' : 'expenses'
  return <TaskDialog title={kind === 'incomes' ? 'Receive income' : 'Pay expense'} close={close}>
    <form className="task-form" onSubmit={event => {
      event.preventDefault()
      void actions.settle(kind, entry.row.id, id, entry.projected ? entry.date : undefined, close)
    }}>
      <label>Settlement account<select data-first-field required value={id} onChange={event => setId(event.target.value)}>
        <AccountOptions accounts={accounts} />
      </select></label>
      <button className="primary" type="submit" disabled={actions.busy || !id}>{kind === 'incomes' ? 'Confirm received' : 'Confirm paid'}</button>
    </form>
  </TaskDialog>
}
