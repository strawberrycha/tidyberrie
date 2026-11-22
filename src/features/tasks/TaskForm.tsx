import { useId, useRef, useState } from 'react'
import { useMinuteClock } from '../../app/useMinuteClock'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { colorLabels, colors, newSubtask, offsets, priorities, statusLabels, statuses, taskScheduleInput } from './input'
import type { SubtaskInput, TaskInput } from './input'
import { IconPicker } from './IconPicker'
import { addDays, localDate, repeatModes, weekdays } from './recurrence'
import type { Repeat } from './recurrence'
import { TaskDialog } from './TaskDialog'

const repeatLabels = ['Once', 'Daily', 'Weekdays', 'Weekends', 'Specific days', 'Weekly', 'Monthly', 'Yearly', 'Custom interval']
const reminderLabels = ['At scheduled time', '5 minutes before', '15 minutes before', '30 minutes before', '1 hour before', '1 day before']

export function TaskForm({ initial, title, occurrence, editing = false, busy, close, save }: {
  initial: TaskInput; title: string; occurrence?: boolean; editing?: boolean; busy: boolean; close: () => void; save: (value: TaskInput) => void
}) {
  const [value, setValue] = useState(initial)
  const today = localDate(useMinuteClock())
  const minimum = editing && initial.startDate < today && value.startDate === initial.startDate ? initial.startDate : today
  const dateChips = [['Today', today], ['Tomorrow', addDays(today, 1)], ['Next week', addDays(today, 7)]]
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [more, setMore] = useState(false)
  const prefix = useId()
  const fields = useRef(new Map<string, HTMLInputElement>())

  function set<K extends keyof TaskInput>(key: K, next: TaskInput[K]) {
    setValue(previous => ({ ...previous, [key]: next }))
  }

  function repeat<K extends keyof Repeat>(key: K, next: Repeat[K]) {
    set('repeat', { ...value.repeat, [key]: next })
  }

  function field(name: string) {
    return { id: prefix + name, 'aria-invalid': errors[name] ? true : undefined, 'aria-describedby': errors[name] ? prefix + name + '-error' : undefined }
  }

  function error(name: string) {
    return errors[name] && <span id={prefix + name + '-error'} className="task-error">{errors[name]}</span>
  }

  function add(after = value.subtasks.length - 1) {
    if (value.subtasks.length >= 100) return
    const item = newSubtask()
    const next = [...value.subtasks]
    next.splice(after + 1, 0, item)
    set('subtasks', next)
    requestAnimationFrame(() => fields.current.get(item.id)?.focus())
  }

  function updateSubtask(index: number, change: Partial<SubtaskInput>) {
    set('subtasks', value.subtasks.map((item, position) => position === index ? { ...item, ...change } : item))
  }

  function reorder(index: number, to: number) {
    const next = [...value.subtasks]
    ;[next[index], next[to]] = [next[to], next[index]]
    set('subtasks', next)
    requestAnimationFrame(() => fields.current.get(next[to].id)?.focus())
  }

  function cancel() {
    if (busy) return
    if (JSON.stringify(value) === JSON.stringify(initial) || window.confirm('Discard unsaved changes?')) close()
  }

  return <TaskDialog title={title} close={cancel}>
    <form className="task-form" noValidate onSubmit={event => {
      event.preventDefault()
      const result = taskScheduleInput(editing ? initial : undefined).safeParse(value)
      if (result.success) { setErrors({}); save(result.data); return }
      const messages = Object.fromEntries(result.error.issues.map(issue => [issue.path.join('.'), issue.message]))
      setErrors(messages)
      if (Object.keys(messages).some(name => !/^(title|startDate|startTime|endTime|subtasks)(\.|$)/.test(name))) setMore(true)
      requestAnimationFrame(() => event.target instanceof HTMLElement &&
        event.target.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    }}>
      <label><span className="task-field-label">Title</span><input data-first-field {...field('title')} value={value.title} maxLength={120} required onChange={event => set('title', event.target.value)} />{error('title')}</label>
      <div className="task-date-chips" aria-label="Quick dates" role="group">
        {dateChips.map(([label, date]) => <button className="secondary" key={date} type="button"
          aria-pressed={value.startDate === date} onClick={() => {
            set('startDate', date)
            setErrors(previous => ({ ...previous, startDate: '' }))
          }}><span>{label}</span></button>)}
      </div>
      <div className="task-fields">
        <label><span className="task-field-label">Date</span><input {...field('startDate')} type="date" min={minimum} required value={value.startDate} onChange={event => {
          const date = event.target.value
          set('startDate', date)
          setErrors(previous => ({ ...previous, startDate: date && date < today && (!editing || date !== initial.startDate) ? 'Pick today or a later date.' : '' }))
        }} />{error('startDate')}</label>
        <label className="task-check"><input type="checkbox" checked={value.allDay} onChange={event => set('allDay', event.target.checked)} /> All day</label>
        {!value.allDay && <>
          <label>Start time<input {...field('startTime')} type="time" value={value.startTime} onChange={event => set('startTime', event.target.value)} />{error('startTime')}</label>
          <label>End time<input {...field('endTime')} type="time" min={value.startTime || undefined} value={value.endTime} onChange={event => set('endTime', event.target.value)} />{error('endTime')}</label>
        </>}
      </div>
      <button type="button" className="secondary" aria-expanded={more} aria-controls={prefix + 'options'} onClick={() => setMore(!more)}>More options</button>
      <div className="task-options" id={prefix + 'options'} hidden={!more}>
        <label>Description<textarea {...field('description')} value={value.description} maxLength={2000} rows={3} onChange={event => set('description', event.target.value)} />{error('description')}</label>
        <div className="task-fields">
          <label>Color<select value={value.color} onChange={event => set('color', event.target.value as TaskInput['color'])}>{colors.map((color, index) => <option key={color} value={color}>{colorLabels[index]}</option>)}</select></label>
          <label>Tag<input {...field('tag')} value={value.tag} maxLength={30} onChange={event => set('tag', event.target.value)} />{error('tag')}</label>
          <label>Priority<select value={value.priority} onChange={event => set('priority', event.target.value as TaskInput['priority'])}>{priorities.map(priority => <option key={priority}>{priority}</option>)}</select></label>
          <label>Status<select value={value.status} onChange={event => set('status', event.target.value as TaskInput['status'])}>
            {statuses.filter(status => status !== 'done' || occurrence || value.repeat.mode === 'once').map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select></label>
          <label className="task-check"><input type="checkbox" checked={value.pinned} onChange={event => set('pinned', event.target.checked)} /> Pinned</label>
        </div>
        <IconPicker value={value.icon} change={icon => set('icon', icon)} />
        {!occurrence && <fieldset>
          <legend>Recurrence</legend>
          <label>Repeat<select value={value.repeat.mode} onChange={event => {
            const mode = event.target.value as Repeat['mode']
            setValue(previous => ({ ...previous, status: mode !== 'once' && previous.status === 'done' ? 'todo' : previous.status,
              repeat: { ...previous.repeat, mode, ...(mode === 'once' ? { until: '', count: undefined } : {}) } }))
          }}>{repeatModes.map((mode, index) => <option key={mode} value={mode}>{repeatLabels[index]}</option>)}</select></label>
          {value.repeat.mode === 'specific' && <fieldset {...field('repeat.weekdays')}>
            <legend>Days of the week</legend>
            <div className="task-checks">{weekdays.map((day, index) => <label key={day} className="task-check">
              <input type="checkbox" checked={value.repeat.weekdays.includes(index)} onChange={event => repeat('weekdays', event.target.checked
                ? [...value.repeat.weekdays, index] : value.repeat.weekdays.filter(number => number !== index))} /> {day}
            </label>)}</div>{error('repeat.weekdays')}
          </fieldset>}
          {value.repeat.mode === 'custom' && <div className="task-fields">
            <label>Every<input {...field('repeat.interval')} type="number" min={1} max={365} value={value.repeat.interval || ''} onChange={event => repeat('interval', Number(event.target.value))} />{error('repeat.interval')}</label>
            <label>Unit<select value={value.repeat.unit} onChange={event => repeat('unit', event.target.value as Repeat['unit'])}><option>days</option><option>weeks</option><option>months</option></select></label>
          </div>}
          {value.repeat.mode !== 'once' && <div className="task-fields">
            <label>End date (optional)<input {...field('repeat.until')} type="date" min={value.startDate || undefined} value={value.repeat.until} disabled={value.repeat.count !== undefined} onChange={event => repeat('until', event.target.value)} />{error('repeat.until')}</label>
            <label>Max occurrences (optional)<input {...field('repeat.count')} type="number" min={1} max={10000} disabled={!!value.repeat.until}
              value={value.repeat.count ?? ''} onChange={event => repeat('count', event.target.value ? Number(event.target.value) : undefined)} />{error('repeat.count')}</label>
          </div>}
        </fieldset>}
        <fieldset>
          <legend>Reminders</legend>
          <p>Tasks without a start time use 9:00 AM. Manage notification permissions in More → Reminders and Alarms.</p>
          <div className="task-checks">{offsets.map((offset, index) => <label className="task-check" key={offset}>
            <input type="checkbox" checked={value.reminders.includes(offset)} onChange={event => set('reminders', event.target.checked ? [...value.reminders, offset] : value.reminders.filter(item => item !== offset))} /> {reminderLabels[index]}
          </label>)}</div>
        </fieldset>
      </div>
      <fieldset className="subtask-editor">
        <legend className="task-field-label">Subtasks</legend>
        {value.subtasks.map((item, index) => <div className="subtask-edit" key={item.id}>
          <label>Subtask {index + 1}<input {...field('subtasks.' + index + '.title')} ref={element => {
            if (element) fields.current.set(item.id, element)
            else fields.current.delete(item.id)
          }} value={item.title} required maxLength={120} onChange={event => updateSubtask(index, { title: event.target.value })}
            onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); add(index) } }} />{error('subtasks.' + index + '.title')}</label>
          <label>Due time<input type="time" {...field('subtasks.' + index + '.dueTime')} value={item.dueTime} onChange={event => {
            const dueTime = event.target.value
            updateSubtask(index, { dueTime, reminder: dueTime ? item.reminder : undefined })
          }} />{error('subtasks.' + index + '.dueTime')}</label>
          <label>Subtask reminder<select value={item.reminder ?? ''} disabled={!item.dueTime}
            onChange={event => updateSubtask(index, { reminder: offsets.find(offset => String(offset) === event.target.value) })}>
            <option value="">No reminder</option>
            {offsets.map((offset, index) => <option key={offset} value={offset}>{reminderLabels[index]}</option>)}
          </select></label>
          <div className="task-actions">
            <button type="button" className="icon-button" disabled={!index} aria-label={'Move subtask ' + (index + 1) + ' up'} onClick={() => reorder(index, index - 1)}><ArrowUp size={18} aria-hidden /></button>
            <button type="button" className="icon-button" disabled={index === value.subtasks.length - 1} aria-label={'Move subtask ' + (index + 1) + ' down'} onClick={() => reorder(index, index + 1)}><ArrowDown size={18} aria-hidden /></button>
            <button type="button" className="icon-button" aria-label={'Delete subtask ' + (index + 1)} onClick={() => set('subtasks', value.subtasks.filter(child => child.id !== item.id))}><Trash2 size={18} aria-hidden /></button>
          </div>
        </div>)}
        {error('subtasks')}
        <button type="button" className="secondary" disabled={value.subtasks.length >= 100} onClick={() => add()}><Plus size={18} aria-hidden /> Add subtask</button>
        {!!value.subtasks.length && <label className="task-check"><input type="checkbox" checked={value.autoCompleteWhenSubtasksDone} onChange={event => set('autoCompleteWhenSubtasksDone', event.target.checked)} /> Complete automatically when all subtasks are checked</label>}
      </fieldset>
      {!!Object.keys(errors).length && <p className="task-error" role="alert">Check the highlighted fields.</p>}
      <footer className="task-actions task-form-footer"><button className="secondary" type="button" disabled={busy} onClick={cancel}>Cancel</button><button className="primary" type="submit" disabled={busy}>Save task</button></footer>
    </form>
  </TaskDialog>
}
