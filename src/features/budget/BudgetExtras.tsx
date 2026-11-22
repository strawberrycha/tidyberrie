import { useMemo, useState } from 'react'
import { CircleAlert, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Records } from '../../shared/db/schemas'
import { useLocalClock } from '../calendar/useCalendarData'
import { TaskDialog } from '../tasks/TaskDialog'
import { offsets } from '../tasks/input'
import { localDate } from '../tasks/recurrence'
import { Amount } from './BudgetCards'
import { AccountOptions, MoneyInput } from './BudgetEditor'
import { activeBudget, budgetEngine, categoryProgress, debtProgress, goalProgress, moneyInputValue, spendingByCategory } from './engine'
import type { ExtraKind } from './extraRepository'
import { useBudget } from './useBudget'
import { useExtraActions } from './useExtras'
import type { BudgetData } from './model'
import './budget.css'

type Extra = Records[ExtraKind]
const labels = { categoryBudgets: 'Category budget', goals: 'Savings goal', debts: 'Utang' }
const nameOf = (item: Extra) => 'category' in item ? item.category : 'person' in item ? item.person : item.name

function ExtraForm({ kind, item, today, accounts, close }: {
  kind: ExtraKind; item?: Extra; today: string; accounts: Records['accounts'][]; close: () => void
}) {
  const actions = useExtraActions()
  const [amount, setAmount] = useState(item ? moneyInputValue('limit' in item ? item.limit : 'target' in item ? item.target : item.amount) : '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const debt = item && 'person' in item ? item : undefined
  const [direction, setDirection] = useState(debt?.direction ?? 'owe')
  const goal = item && 'target' in item ? item : undefined
  const field = kind === 'categoryBudgets' ? 'category' : kind === 'goals' ? 'name' : 'person'
  const moneyField = kind === 'categoryBudgets' ? 'limit' : kind === 'goals' ? 'target' : 'amount'
  const error = (key: string) => errors[key] && <p className="task-error" role="alert">{errors[key]}</p>

  return <TaskDialog title={(item ? 'Edit ' : 'Add ') + labels[kind].toLowerCase()} close={close}>
    <form className="task-form" noValidate onSubmit={event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      const value = {
        [field]: String(data.get(field) ?? ''), [moneyField]: amount,
        ...(kind === 'goals' ? { targetDate: String(data.get('targetDate') ?? '') || undefined } : {}),
        ...(kind === 'debts' ? {
          direction, dueDate: data.get('dueDate'),
          dueReminder: data.get('dueReminder') === '' ? undefined : Number(data.get('dueReminder')),
          ...(direction === 'internal' ? {
            fromAccountId: data.get('fromAccountId') || undefined, toAccountId: data.get('toAccountId') || undefined,
          } : {}),
        } : {}),
      }
      const result = actions.schemas[kind].safeParse(value)
      if (!result.success) {
        setErrors(Object.fromEntries(result.error.issues.map(issue => [issue.path[0], issue.message])))
        return
      }
      void actions.save(kind, value, item?.id, close)
    }}>
      <label>{kind === 'categoryBudgets' ? 'Category' : kind === 'debts' ? direction === 'internal' ? 'Utang label' : 'Person' : 'Goal name'}
        <input name={field} defaultValue={item ? nameOf(item) : ''} maxLength={80} aria-invalid={!!errors[field]} />{error(field)}
      </label>
      <MoneyInput label={kind === 'categoryBudgets' ? 'Monthly limit (PHP)' : kind === 'goals' ? 'Target (PHP)' : 'Principal (PHP)'}
        value={amount} change={setAmount} error={errors[moneyField]} />
      {kind === 'goals' && <label>Target date (optional)<input type="date" name="targetDate" defaultValue={goal?.targetDate} />{error('targetDate')}</label>}
      {kind === 'debts' && <>
        <label>Who owes whom<select name="direction" value={direction} onChange={event => setDirection(event.target.value as Records['debts']['direction'])}>
          <option value="owe">I owe them</option><option value="owed">They owe me</option>
          <option value="internal">Between my accounts</option>
        </select>{error('direction')}</label>
        {direction === 'internal' && <>
          <label>Account that owes<select name="fromAccountId" defaultValue={debt?.fromAccountId ?? ''}><AccountOptions accounts={accounts} /></select>{error('fromAccountId')}</label>
          <label>Receiving account<select name="toAccountId" defaultValue={debt?.toAccountId ?? ''}><AccountOptions accounts={accounts} /></select>{error('toAccountId')}</label>
        </>}
        <label>Due date<input type="date" name="dueDate" defaultValue={debt?.dueDate ?? today} />{error('dueDate')}</label>
        <label>Due-date reminder<select name="dueReminder" defaultValue={debt?.dueReminder ?? ''}>
          <option value="">No reminder</option>{offsets.map(offset => <option key={offset} value={offset}>{offset ? offset + ' minutes before 9:00 AM' : 'On the due date at 9:00 AM'}</option>)}
        </select>{error('dueReminder')}</label>
      </>}
      <button className="primary" type="submit" disabled={actions.busy}>Save {labels[kind].toLowerCase()}</button>
    </form>
  </TaskDialog>
}

function Movement({ kind, item, accounts, today, close }: {
  kind: 'goals' | 'debts'; item: Records['goals'] | Records['debts']; accounts: Records['accounts'][]; today: string; close: () => void
}) {
  const actions = useExtraActions()
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const candidates = 'target' in item ? accounts.filter(account => account.id !== item.accountId)
    : item.direction === 'internal' ? accounts.filter(account => account.id === item.fromAccountId) : accounts
  return <TaskDialog title={kind === 'goals' ? 'Contribute to goal' : 'Record utang payment'} close={close}>
    <form className="task-form" noValidate onSubmit={event => {
      event.preventDefault()
      const values = Object.fromEntries(new FormData(event.currentTarget))
      const raw = { ...values, amount, recordId: item.id }
      const parsed = actions.schemas.movement.safeParse(raw)
      if (!parsed.success) {
        setErrors(Object.fromEntries(parsed.error.issues.map(issue => [issue.path[0], issue.message])))
        return
      }
      void actions.move(kind, raw, close)
    }}>
      <MoneyInput label="Amount (PHP)" value={amount} change={setAmount} error={errors.amount} />
      <label>Account<select name="accountId"><AccountOptions accounts={candidates} /></select>{errors.accountId && <span className="task-error" role="alert">Choose an account.</span>}</label>
      <label>Date<input name="date" type="date" defaultValue={today} />{errors.date && <span className="task-error" role="alert">{errors.date}</span>}</label>
      <button className="primary" type="submit" disabled={actions.busy || !candidates.length}>{kind === 'goals' ? 'Transfer contribution' : 'Save payment'}</button>
    </form>
  </TaskDialog>
}

function WhatIf({ data, today, close }: { data: BudgetData; today: string; close: () => void }) {
  const actions = useExtraActions()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ReturnType<typeof actions.preview>>()
  return <TaskDialog title="What-if purchase" close={close}>
    <form className="task-form" noValidate onSubmit={event => {
      event.preventDefault()
      const parsed = actions.schemas.preview.safeParse({ amount, date })
      if (!parsed.success) {
        setErrors(Object.fromEntries(parsed.error.issues.map(issue => [issue.path[0], issue.message])))
        setResult(undefined)
        return
      }
      setErrors({})
      setResult(actions.preview(data, { amount, date }, today))
    }}>
      <p>Preview how a planned purchase affects your budget. This preview stays in this dialog.</p>
      <MoneyInput label="Purchase amount (PHP)" value={amount} change={value => { setAmount(value); setResult(undefined) }} error={errors.amount} />
      <label>Purchase date<input type="date" value={date} onChange={event => { setDate(event.target.value); setResult(undefined) }} />
        {errors.date && <span className="task-error" role="alert">{errors.date}</span>}</label>
      <button className="primary" type="submit">Preview purchase</button>
      {result && <div className="budget-controls" aria-label="Purchase preview" aria-live="polite">
        <div><h3>Left this month</h3><p>Before <Amount value={result.before.month} /></p><p>After <Amount value={result.after.month} /></p></div>
        <div><h3>Left overall</h3><p>Before <Amount value={result.before.overall} /></p><p>After <Amount value={result.after.overall} /></p></div>
      </div>}
    </form>
  </TaskDialog>
}

type Dialog =
  | { mode: 'add' | 'preview' }
  | { mode: 'edit'; kind: ExtraKind; item?: Extra }
  | { mode: 'archive'; kind: ExtraKind; item: Extra }
  | { mode: 'payment'; kind: 'goals' | 'debts'; item: Records['goals'] | Records['debts'] }

export function BudgetExtras() {
  const { data, error } = useBudget()
  const actions = useExtraActions()
  const today = localDate(useLocalClock())
  const [dialog, setDialog] = useState<Dialog>()
  const [trash, setTrash] = useState(false)
  const close = () => setDialog(undefined)
  const computed = useMemo(() => data ? { balances: budgetEngine(data, today, 'monthly').balances,
    spending: spendingByCategory(data, today) } : undefined, [data, today])
  if (error) return <p role="alert">Could not load Budget extras.</p>
  if (!data || !computed) return <p role="status">Loading Budget extras…</p>
  const accounts = activeBudget(data).accounts
  const accountName = (id?: string) => accounts.find(account => account.id === id)?.name ?? 'Unavailable account'
  const sections = { categoryBudgets: data.categoryBudgets, goals: data.goals, debts: data.debts }

  return <div className="planner-view budget-view">
    <div className="task-actions">
      <Link className="secondary" to="/budget">Back to Budget</Link>
      <button className="secondary" type="button" onClick={() => setTrash(!trash)}>{trash ? 'Show active records' : 'Budget extras Trash'}</button>
      {!trash && <button className="secondary" type="button" onClick={() => setDialog({ mode: 'preview' })}>What-if purchase</button>}
    </div>
    {(Object.keys(sections) as ExtraKind[]).map(kind => {
      const records = sections[kind].filter(item => !!item.deletedAt === trash)
      return <section className="planner-card" key={kind}>
        <h2>{kind === 'categoryBudgets' ? 'Category budgets' : kind === 'goals' ? 'Savings goals' : 'Utang tracker'}</h2>
        {!records.length && <p>{trash ? 'Nothing in Trash.' : 'No records yet.'}</p>}
        <ul className="budget-rows">{records.map(item => <li className="planner-card" key={item.id}>
          <h3>{nameOf(item)}</h3>
          {trash ? <button type="button" className="secondary" disabled={actions.busy} onClick={() => void actions.archive(kind, item.id, false)}>Restore</button> : <>
            {'limit' in item && (() => {
              const progress = categoryProgress(item, computed.spending)
              return <>
                <p><Amount value={progress.used} /> of <Amount value={item.limit} /></p>
                <p>Paid {<Amount value={progress.paid} />} · Planned {<Amount value={progress.planned} />}</p>
                <progress max={100} value={progress.progress} aria-label={item.category + ' monthly limit used'} />
                {progress.status !== 'within' && <p className="budget-warning"><CircleAlert size={20} aria-hidden />{progress.status === 'over' ? 'Over monthly limit' : 'Near monthly limit'}</p>}
              </>
            })()}
            {'target' in item && (() => {
              const balance = computed.balances.get(item.accountId) ?? 0n
              const progress = goalProgress(item, data.transfers, balance, today)
              return <>
                <p><Amount value={balance} /> of <Amount value={item.target} /></p>
                <progress max={100} value={progress.progress} aria-label={item.name + ' savings progress'} />
                {item.targetDate && <p>Target date {item.targetDate}</p>}
                <p>{progress.remaining <= 0n ? 'Target reached' : progress.projected ? 'Projected completion ' + progress.projected : 'Add regular contributions to see a projection.'}</p>
                <button className="secondary" type="button" onClick={() => setDialog({ mode: 'payment', kind: 'goals', item })}>Contribute</button>
              </>
            })()}
            {'person' in item && (() => {
              const progress = debtProgress(item, data)
              return <>
                <p>{item.direction === 'internal' ? accountName(item.fromAccountId) + ' owes ' + accountName(item.toAccountId)
                  : item.direction === 'owe' ? 'I owe them' : 'They owe me'} · {progress.status} · Due {item.dueDate}</p>
                <p>Principal <Amount value={item.amount} /> · Paid <Amount value={progress.paid} /> · Remaining <Amount value={progress.remaining} /></p>
                {progress.payments.length > 0 && <details className="budget-account-icon"><summary>Payments</summary><ul>
                  {progress.payments.map(payment => <li key={payment.id}>{'date' in payment ? payment.date : payment.expectedDate} · <Amount value={payment.amount} /></li>)}
                </ul></details>}
                {progress.remaining > 0n && <button className="secondary" type="button" onClick={() => setDialog({ mode: 'payment', kind: 'debts', item })}>Record payment</button>}
              </>
            })()}
            <div className="task-actions">
              <button className="secondary" type="button" onClick={() => setDialog({ mode: 'edit', kind, item })}>Edit</button>
              <button className="secondary" type="button" onClick={() => setDialog({ mode: 'archive', kind, item })}>Delete</button>
            </div>
          </>}
        </li>)}</ul>
      </section>
    })}
    {!trash && <button className="primary task-fab" type="button" aria-label="Add budget extra" onClick={() => setDialog({ mode: 'add' })}><Plus size={26} aria-hidden /></button>}
    {dialog?.mode === 'add' && <TaskDialog title="Add budget extra" close={close}><div className="task-actions">
      {(Object.keys(labels) as ExtraKind[]).map(kind => <button className="secondary" type="button" key={kind} onClick={() => setDialog({ mode: 'edit', kind })}>{labels[kind]}</button>)}
    </div></TaskDialog>}
    {dialog?.mode === 'edit' && <ExtraForm kind={dialog.kind} item={dialog.item} today={today} accounts={accounts} close={close} />}
    {dialog?.mode === 'payment' && <Movement kind={dialog.kind} item={dialog.item} accounts={accounts} today={today} close={close} />}
    {dialog?.mode === 'preview' && <WhatIf data={data} today={today} close={close} />}
    {dialog?.mode === 'archive' && <TaskDialog title="Move to Budget extras Trash?" close={close}>
      <p>{nameOf(dialog.item)}</p>
      {'target' in dialog.item && <p>The linked savings account and its transactions stay available in Budget.</p>}
      <div className="task-actions">
        <button data-first-field className="secondary" type="button" onClick={close}>Cancel</button>
        <button className="primary" type="button" disabled={actions.busy}
          onClick={() => void actions.archive(dialog.kind, dialog.item.id, true, close)}>Move to Trash</button>
      </div>
    </TaskDialog>}
  </div>
}
