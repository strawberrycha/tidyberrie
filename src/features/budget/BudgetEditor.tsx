import { useState } from 'react'
import type { Records } from '../../shared/db/schemas'
import { TaskDialog } from '../tasks/TaskDialog'
import { IconPicker } from '../tasks/IconPicker'
import { colors, colorLabels, icons, offsets } from '../tasks/input'
import { decodeRepeat, defaultRepeat, repeatModes, weekdays } from '../tasks/recurrence'
import type { Repeat } from '../tasks/recurrence'
import type { IconKey } from '../../assets/stickers/keys'
import { moneyInputValue } from './engine'
import { categories, kinds, sources } from './model'
import type { BudgetTable } from './model'
import type { BudgetActions } from './useBudget'

export type EditorRow = Records[BudgetTable]
export function AccountOptions({ accounts }: { accounts: Records['accounts'][] }) {
  return <><option value="">Choose account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</>
}

export function MoneyInput({ label, value, change, error }: {
  label: string; value: string; change: (value: string) => void; error?: string
}) {
  return <label>{label}<input data-first-field type="text" inputMode="decimal" autoComplete="off" required value={value}
    aria-invalid={!!error} onChange={event => change(event.target.value)} />{error && <span className="task-error" role="alert">{error}</span>}</label>
}

function CategoryChoice({ label, value, choices, change, error }: {
  label: string; value: string; choices: readonly string[]; change: (value: string) => void; error?: string
}) {
  const [custom, setCustom] = useState(!choices.includes(value) && !!value)
  return <>
    <label>{label}<select value={custom ? '__custom' : value} onChange={event => {
      setCustom(event.target.value === '__custom')
      change(event.target.value === '__custom' ? '' : event.target.value)
    }}>
      <option value="">Choose {label.toLowerCase()}</option>
      {choices.map(item => <option key={item} value={item}>{item}</option>)}
      <option value="__custom">Custom</option>
    </select></label>
    {custom && <label>Custom {label.toLowerCase()}<input value={value} maxLength={80} onChange={event => change(event.target.value)} /></label>}
    {error && <p className="task-error" role="alert">{error}</p>}
  </>
}

function Repeats({ value, change }: { value: Repeat; change: (value: Repeat) => void }) {
  return <fieldset>
    <legend>Recurring expense</legend>
    <label>Repeat<select value={value.mode} onChange={event => change({ ...defaultRepeat, mode: event.target.value as Repeat['mode'] })}>
      {repeatModes.map(mode => <option key={mode}>{mode}</option>)}
    </select></label>
    {value.mode === 'specific' && <div className="task-checks">{weekdays.map((day, index) =>
      <label className="task-check" key={day}><input type="checkbox" checked={value.weekdays.includes(index)} onChange={event =>
        change({ ...value, weekdays: event.target.checked ? [...value.weekdays, index] : value.weekdays.filter(day => day !== index) })} />{day}</label>)}</div>}
    {value.mode === 'custom' && <>
      <label>Interval<input type="number" min="1" max="365" value={value.interval} onChange={event => change({ ...value, interval: Number(event.target.value) })} /></label>
      <label>Repeat unit<select value={value.unit} onChange={event => change({ ...value, unit: event.target.value as Repeat['unit'] })}>
        <option>days</option><option>weeks</option><option>months</option>
      </select></label>
    </>}
    {value.mode !== 'once' && <>
      <label>Repeat end date<input type="date" value={value.until} disabled={value.count !== undefined} onChange={event => change({ ...value, until: event.target.value })} /></label>
      <label>Maximum occurrences<input type="number" min="1" max="10000" value={value.count ?? ''} disabled={!!value.until}
        onChange={event => change({ ...value, count: event.target.value ? Number(event.target.value) : undefined })} /></label>
    </>}
  </fieldset>
}

export function BudgetEditor({ kind, row, today, accounts, actions, week, close }: {
  kind: BudgetTable; row?: EditorRow; today: string; accounts: Records['accounts'][];
  actions: BudgetActions; week: number; close: () => void
}) {
  const [fields, setFields] = useState<Record<string, string>>((): Record<string, string> => {
    if (kind === 'accounts') {
      const account = row as Records['accounts'] | undefined
      return { name: account?.name ?? '', type: account?.type ?? 'cash', color: colors.find(color => color === account?.color) ?? 'rose',
        icon: icons.find(icon => icon === account?.icon) ?? 'budget-day', openingBalance: moneyInputValue(account?.openingBalance ?? 0) }
    }
    const amount = row && 'amount' in row ? moneyInputValue(row.amount) : ''
    const accountId = row && 'accountId' in row ? row.accountId : accounts[0]?.id ?? ''
    if (kind === 'incomes') {
      const income = row as Records['incomes'] | undefined
      return { amount, accountId, expectedDate: income?.expectedDate ?? today, source: income?.source ?? sources[0] }
    }
    if (kind === 'expenses') {
      const expense = row as Records['expenses'] | undefined
      return { amount, accountId, date: expense?.date ?? today, category: expense?.category ?? categories[0], notes: expense?.notes ?? '',
        billReminder: expense?.billReminder?.toString() ?? '' }
    }
    const transfer = row as Records['transfers'] | undefined
    return { amount, date: transfer?.date ?? today, fromAccountId: transfer?.fromAccountId ?? accounts[0]?.id ?? '',
      toAccountId: transfer?.toAccountId ?? accounts[1]?.id ?? '' }
  })
  const [repeat, setRepeat] = useState(() => row && 'recurrenceRule' in row ? decodeRepeat(row.recurrenceRule) : defaultRepeat)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (key: string, value: string) => setFields(previous => ({ ...previous, [key]: value }))
  const error = (key: string) => errors[key] && <span className="task-error" role="alert">{errors[key]}</span>
  const input = (key: string, label: string, type = 'text') =>
    <label>{label}<input data-first-field={key === 'name' ? true : undefined} type={type} value={fields[key]} required
      aria-invalid={!!errors[key]} onChange={event => set(key, event.target.value)} />{error(key)}</label>
  const account = (key: string, label: string) => <label>{label}<select value={fields[key]} required aria-invalid={!!errors[key]}
    onChange={event => set(key, event.target.value)}><AccountOptions accounts={accounts} /></select>{error(key)}</label>

  return <TaskDialog title={(row ? 'Edit ' : 'Add ') + kinds[kind].toLowerCase()} close={close}>
    <form className="task-form" noValidate onSubmit={event => {
      event.preventDefault()
      const value = kind === 'expenses' ? { ...fields, repeat, billReminder: fields.billReminder === '' ? undefined : Number(fields.billReminder) } : fields
      const checked = actions.check(kind, value)
      if (!checked.success) {
        setErrors(Object.fromEntries(checked.error.issues.map(issue => [issue.path[0], issue.message])))
        return
      }
      void actions.save(kind, value, row?.id, week, close)
    }}>
      <MoneyInput label={kind === 'accounts' ? 'Opening balance (PHP)' : 'Amount (PHP)'}
        value={fields[kind === 'accounts' ? 'openingBalance' : 'amount']}
        change={value => set(kind === 'accounts' ? 'openingBalance' : 'amount', value)}
        error={errors[kind === 'accounts' ? 'openingBalance' : 'amount']} />
      {kind === 'accounts' && <>
        {input('name', 'Name')}
        <label>Type<select value={fields.type} onChange={event => set('type', event.target.value)}><option value="cash">Cash on hand</option><option value="online">Online account</option></select></label>
        <label>Color<select value={fields.color} onChange={event => set('color', event.target.value)}>{colors.map((color, index) =>
          <option value={color} key={color}>{colorLabels[index]}</option>)}</select></label>
        <details className="budget-account-icon"><summary>Account icon</summary><IconPicker value={fields.icon as IconKey} change={icon => set('icon', icon)} /></details>
      </>}
      {kind === 'incomes' && <>
        <CategoryChoice label="Source" choices={sources} value={fields.source} change={value => set('source', value)} error={errors.source} />
        {input('expectedDate', 'Expected date', 'date')}{account('accountId', 'Account')}
      </>}
      {kind === 'expenses' && <>
        <CategoryChoice label="Category" choices={categories} value={fields.category} change={value => set('category', value)} error={errors.category} />
        {input('date', 'Date', 'date')}{account('accountId', 'Account')}
        <label>Notes<textarea maxLength={2000} value={fields.notes} onChange={event => set('notes', event.target.value)} />{error('notes')}</label>
        {(!row || !('status' in row) || row.status !== 'paid') && <>
          <label>Bill reminder<select value={fields.billReminder} onChange={event => set('billReminder', event.target.value)}>
            <option value="">No reminder</option>{offsets.map(offset => <option key={offset} value={offset}>{offset === 0 ? 'On the due date at 9:00 AM' : offset + ' minutes before 9:00 AM'}</option>)}
          </select>{error('billReminder')}</label>
          <Repeats value={repeat} change={setRepeat} />
        </>}{error('repeat')}
      </>}
      {kind === 'transfers' && <>{input('date', 'Date', 'date')}{account('fromAccountId', 'From account')}{account('toAccountId', 'To account')}</>}
      <button type="submit" className="primary" disabled={actions.busy}>Save {kinds[kind].toLowerCase()}</button>
    </form>
  </TaskDialog>
}
