import { useId, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { inlineIconSize } from '../../app/uiTokens'
import { useMinuteClock } from '../../app/useMinuteClock'
import { newSubtask, taskScheduleInput } from './input'
import type { TaskInput } from './input'
import { ColorSelect } from './ColorSelect'
import { useSuggestedIcon } from './suggestIcon'
import { IconCarousel } from './IconPicker'
import { localDate, weekdays } from './recurrence'
import { TaskDialog } from './TaskDialog'
import { DateField, TimeField } from './TypedFields'

const repeatOptions = [['once', 'Never'], ['daily', 'Every day'], ['weekdays', 'Weekdays'], ['weekends', 'Weekends'], ['specific', 'Pick days']] as const

export function TaskForm({ initial, title, occurrence, editing = false, busy, close, save }: {
  initial: TaskInput; title: string; occurrence?: boolean; editing?: boolean; busy: boolean; close: () => void;
  save: (value: TaskInput) => void; duplicate?: () => void
}) {
  const baseline = editing ? initial : { ...initial, allDay: false, color: initial.color || (initial.categoryId ? '' : 'rose') as TaskInput['color'] }
  const [value, setValue] = useState(baseline)
  const [icon, pickIcon] = useSuggestedIcon(value.title, editing ? initial.icon : undefined)
  const today = localDate(useMinuteClock())
  const minimum = editing && initial.startDate < today && value.startDate === initial.startDate ? initial.startDate : today
  const [errors, setErrors] = useState<Record<string, string>>({})
  const prefix = useId()
  const fields = useRef(new Map<string, HTMLInputElement>())

  function set<K extends keyof TaskInput>(key: K, next: TaskInput[K]) {
    setValue(previous => ({ ...previous, [key]: next }))
    setErrors(previous => ({ ...previous, [key]: '' }))
  }

  function field(name: string) {
    return { id: prefix + name, 'aria-invalid': !!errors[name], 'aria-describedby': errors[name] ? prefix + name + '-error' : undefined }
  }
  function error(name: string) {
    return errors[name] && <span id={prefix + name + '-error'} className="task-error" role="alert">{errors[name]}</span>
  }

  function add(after = value.subtasks.length - 1) {
    if (value.subtasks.length >= 100) return
    const item = newSubtask()
    const next = value.subtasks.slice()
    next.splice(after + 1, 0, item)
    set('subtasks', next)
    requestAnimationFrame(() => fields.current.get(item.id)?.focus())
  }
  function reorder(index: number, to: number) {
    const next = value.subtasks.slice()
    ;[next[index], next[to]] = [next[to], next[index]]
    set('subtasks', next)
    requestAnimationFrame(() => fields.current.get(next[to].id)?.focus())
  }
  function cancel() {
    if (!busy && (JSON.stringify(value) === JSON.stringify(baseline) || window.confirm('Discard unsaved changes?'))) close()
  }

  const customRepeat = !repeatOptions.some(([mode]) => mode === value.repeat.mode)
  return <TaskDialog title={title} close={cancel} full>
    <form className="task-form" noValidate onSubmit={event => {
      event.preventDefault()
      if (busy) return
      const form = event.currentTarget
      const result = taskScheduleInput(editing ? initial : undefined, new Date(), occurrence).safeParse({ ...value, icon })
      const messages: Record<string, string> = result.success ? {} : Object.fromEntries(result.error.issues.map(issue => [issue.path.join('.'), issue.message]))
      if (!value.allDay && !value.startTime) messages.startTime = 'Enter a time.'
      if (result.success && !Object.keys(messages).length) { setErrors({}); save(result.data); return }
      setErrors(messages)
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    }}>
      <label>Title<input data-first-field {...field('title')} value={value.title} maxLength={120} required onChange={event => set('title', event.target.value)} />{error('title')}</label>
      <label>Description<textarea {...field('description')} value={value.description} maxLength={2000} rows={3} onChange={event => set('description', event.target.value)} />{error('description')}</label>
      <ColorSelect value={value.color || 'rose'} change={color => set('color', color)} inherit={value.categoryId ? () => set('color', '') : undefined} inherited={!!value.categoryId && !value.color} />
      <IconCarousel value={icon} change={next => { pickIcon(next); set('icon', next) }} />
      <DateField label="Date" value={value.startDate} change={date => set('startDate', date)} min={minimum} required />
      {error('startDate')}
      <label className="task-check"><input type="checkbox" checked={value.allDay} onChange={event => {
        const allDay = event.target.checked
        setValue(previous => ({ ...previous, allDay, ...(allDay ? { reminders: [], alertNotify: false } : {}) }))
      }} /> All day</label>
      {!value.allDay && <><TimeField label="Time" value={value.startTime} change={time => set('startTime', time)} required />
        {error('startTime')}{error('endTime')}</>}
      <fieldset><legend>Alerts</legend>
        <label className="task-check"><input type="checkbox" checked={!value.allDay && value.reminders.length > 0} disabled={value.allDay} onChange={event => {
          const alertNotify = event.target.checked
          setValue(previous => ({ ...previous, alertNotify, reminders: alertNotify ? [0] : [] }))
        }} /> Notify</label>
        {value.allDay && <p>Add a time to get a reminder</p>}
      </fieldset>
      {!occurrence && <fieldset>
        <label>Repeat every<select value={customRepeat ? 'existing' : value.repeat.mode} onChange={event => {
          const mode = repeatOptions.find(([key]) => key === event.target.value)?.[0]
          if (mode) set('repeat', { ...value.repeat, mode, interval: 1, unit: 'days', ...(mode === 'once' ? { until: '', count: undefined } : {}) })
        }}>
          {repeatOptions.map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
          {customRepeat && <option value="existing">Keep existing repeat</option>}
        </select></label>
        {value.repeat.mode === 'specific' && <fieldset><legend>Days of the week</legend>
          <div className="task-actions">{[1, 2, 3, 4, 5, 6, 0].map(index =>
            <button key={index} type="button" className="secondary" aria-pressed={value.repeat.weekdays.includes(index)}
              onClick={() => set('repeat', { ...value.repeat, weekdays: value.repeat.weekdays.includes(index)
                ? value.repeat.weekdays.filter(day => day !== index) : [...value.repeat.weekdays, index] })}>{weekdays[index]}</button>)}</div>
          {error('repeat.weekdays')}
        </fieldset>}
        {error('repeat.until')}
      </fieldset>}
      <fieldset className="subtask-editor"><legend>Subtasks</legend>
        {value.subtasks.map((item, index) => <div className="subtask-edit" key={item.id}>
          <label>Subtask {index + 1}<input {...field('subtasks.' + index + '.title')} ref={element => {
            if (element) fields.current.set(item.id, element)
            else fields.current.delete(item.id)
          }} value={item.title} required maxLength={120} onChange={event => {
            const title = event.target.value
            set('subtasks', value.subtasks.map((child, pos) => pos === index ? { ...child, title } : child))
          }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); add(index) } }} />
          {error('subtasks.' + index + '.title')}</label>
          <div className="task-actions">
            <button type="button" className="icon-button" disabled={!index} aria-label={'Move subtask ' + (index + 1) + ' up'} onClick={() => reorder(index, index - 1)}><ArrowUp size={inlineIconSize} aria-hidden /></button>
            <button type="button" className="icon-button" disabled={index === value.subtasks.length - 1} aria-label={'Move subtask ' + (index + 1) + ' down'} onClick={() => reorder(index, index + 1)}><ArrowDown size={inlineIconSize} aria-hidden /></button>
            <button type="button" className="icon-button" aria-label={'Delete subtask ' + (index + 1)} onClick={() => set('subtasks', value.subtasks.filter(child => child.id !== item.id))}><Trash2 size={inlineIconSize} aria-hidden /></button>
          </div>
        </div>)}
        {error('subtasks')}
        <button type="button" className="secondary" disabled={value.subtasks.length >= 100} onClick={() => add()}><Plus size={inlineIconSize} aria-hidden /> Add subtask</button>
        {!!value.subtasks.length && <label className="task-check"><input type="checkbox" checked={value.autoCompleteWhenSubtasksDone} onChange={event => set('autoCompleteWhenSubtasksDone', event.target.checked)} /> Complete automatically when all subtasks are checked</label>}
      </fieldset>
      {Object.values(errors).some(Boolean) && <p className="task-error" role="alert">Check the highlighted fields.</p>}
      <footer className="task-actions task-form-footer"><button className="secondary" type="button" disabled={busy} onClick={cancel}>Cancel</button><button className="primary" type="submit" disabled={busy}>Save task</button></footer>
    </form>
  </TaskDialog>
}
