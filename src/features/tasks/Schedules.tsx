import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useToast } from '../../shared/ui/Toast'
import { AppBar } from '../../app/AppBar'
import { inlineIconSize } from '../../app/uiTokens'
import { colorLabels, colors, emptyTask } from './input'
import { IconPicker } from './IconPicker'
import { useSchedules } from './useSchedules'
import type { Schedule } from './useSchedules'
import { TaskDialog } from './TaskDialog'
import { TaskForm } from './TaskForm'
import { TaskIcon } from './icons'
import { useTaskActions, useTaskGroups } from './useTasks'
import { localDate } from './recurrence'
import { compareScheduleTasks, taskValue } from './model'
import { deleteSchedule, duplicateSchedule, moveSchedule, moveScheduleTask, saveSchedule } from './scheduleService'
import './tasks.css'

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const defaults = { name: '', days: [] as number[], paused: false, startDate: null, endDate: null, color: 'rose', icon: 'check' } as
  Pick<Schedule, 'name' | 'days' | 'paused' | 'startDate' | 'endDate' | 'color' | 'icon'>

function draftOf(item: typeof defaults): typeof defaults {
  const { name, days, paused, startDate, endDate, color, icon } = item
  return { name, days, paused, startDate, endDate, color, icon }
}

export function ScheduleDays({ days, setDays }: { days: number[]; setDays: (days: number[]) => void }) {
  return <fieldset><legend>Days</legend>
    <div className="task-actions">{[1, 2, 3, 4, 5, 6, 0].map(day =>
      <button className="secondary" type="button" key={day} aria-label={weekdays[day]} aria-pressed={days.includes(day)}
        onClick={() => setDays(days.includes(day) ? days.filter(item => item !== day) : [...days, day])}>{weekdays[day].slice(0, 3)}</button>)}</div>
    <div className="task-actions">
      <button className="secondary" type="button" onClick={() => setDays([1, 2, 3, 4, 5])}>Weekdays</button>
      <button className="secondary" type="button" onClick={() => setDays([0, 6])}>Weekends</button>
      <button className="secondary" type="button" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>Every day</button>
    </div>
  </fieldset>
}

export function Schedules() {
  const { rows, error: loadError } = useSchedules()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Schedule | 'new' | undefined>(() => params.has('new') ? 'new' : undefined)
  const [copying, setCopying] = useState<Schedule>()
  const [menu, setMenu] = useState<Schedule>()
  const [draft, setDraft] = useState(defaults)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [task, setTask] = useState<{ value: ReturnType<typeof emptyTask>; id?: string }>()
  const [timePicker, setTimePicker] = useState(false)
  const [time, setTime] = useState('')
  const notify = useToast()
  const groups = useTaskGroups(false)?.groups ?? []
  const actions = useTaskActions()
  const today = localDate()
  const timeline = editing && editing !== 'new' ? groups.filter(group => group.task.scheduleId === editing.id)
    .sort((a, b) => compareScheduleTasks(a.task, b.task)) : []
  const closeEditor = () => {
    const initial = editing && editing !== 'new' ? draftOf(editing) : defaults
    if (JSON.stringify(draft) !== JSON.stringify(initial) && !window.confirm('Discard unsaved changes?')) return
    setEditing(undefined)
    if (params.has('new')) setParams({})
  }

  useEffect(() => {
    if (!editing || task || timePicker) return
    const back = (event: Event) => {
      if (!document.querySelector('#main .schedule-editor')) return
      event.preventDefault()
      const initial = editing === 'new' ? defaults : draftOf(editing)
      if (JSON.stringify(draft) !== JSON.stringify(initial) && !window.confirm('Discard unsaved changes?')) return
      setEditing(undefined)
      if (params.has('new')) setParams({})
    }
    document.addEventListener('tidyberrie-back', back)
    return () => document.removeEventListener('tidyberrie-back', back)
  }, [draft, editing, params, setParams, task, timePicker])

  function open(item: Schedule | 'new') {
    setDraft(item === 'new' ? defaults : draftOf(item))
    setError('')
    setEditing(item)
    setMenu(undefined)
  }
  async function run(work: () => Promise<void>) {
    setBusy(true)
    setError('')
    try { await work() } catch (failure) {
      setError(failure instanceof Error && 'issues' in failure
        ? (failure.issues as { message: string }[])[0].message : failure instanceof Error ? failure.message : 'Could not save schedule.')
    } finally { setBusy(false) }
  }

  if (editing) return <section className="task-form schedule-editor">
    <AppBar title={editing === 'new' ? 'Create a schedule' : 'Edit schedule'} back={closeEditor} />
    <form className="task-form" noValidate onSubmit={event => {
      event.preventDefault()
      void run(async () => {
        const saved = await saveSchedule(draft, editing === 'new' ? undefined : editing.id)
        setDraft(draftOf(saved))
        setEditing(saved)
        notify({ message: 'Schedule saved.' })
      })
    }}>
      <label>Name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <ScheduleDays days={draft.days} setDays={days => setDraft({ ...draft, days })} />
      <label>Color<select value={draft.color} onChange={event => setDraft({ ...draft, color: event.target.value as Schedule['color'] })}>
        {colors.map((color, index) => <option value={color} key={color}>{colorLabels[index]}</option>)}
      </select></label>
      <IconPicker value={draft.icon} change={icon => setDraft({ ...draft, icon })} />
      <label>Active from<input type="date" value={draft.startDate ?? ''} onChange={event => setDraft({ ...draft, startDate: event.target.value || null })} /></label>
      <label>Active until<input type="date" min={draft.startDate ?? undefined} value={draft.endDate ?? ''} onChange={event => setDraft({ ...draft, endDate: event.target.value || null })} /></label>
      <label className="task-check"><input type="checkbox" role="switch" checked={draft.paused}
        onChange={event => setDraft({ ...draft, paused: event.target.checked })} /> Paused</label>
      <p>Paused schedules do not generate tasks or reminder notifications.</p>
      {error && <p role="alert">{error}</p>}
      <footer className="task-actions task-form-footer"><button type="button" className="secondary" onClick={closeEditor}>Back</button>
        <button className="primary" disabled={busy}>Save schedule</button></footer>
    </form>
    {editing !== 'new' && <>
      <h3>Timeline</h3>
      {timeline.map((group, index) => <div className="task-actions" key={group.task.id}>
        <button className="secondary" onClick={() => setTask({ value: taskValue(group, today), id: group.task.id })}>
          {(group.task.startAt ?? '').slice(11, 16)} · {group.task.title}</button>
        {[-1, 1].filter(offset => timeline[index + offset] && timeline[index + offset].task.startAt?.slice(11, 16) === group.task.startAt?.slice(11, 16))
          .map(offset => {
            const Icon = offset < 0 ? ArrowUp : ArrowDown
            return <button className="icon-button" key={offset} aria-label={'Move ' + group.task.title + (offset < 0 ? ' up' : ' down')}
              disabled={busy} onClick={() => void run(() => moveScheduleTask(editing.id, group.task.id, offset))}>
              <Icon size={inlineIconSize} aria-hidden /></button>
          })}
      </div>)}
      <button className="secondary" onClick={() => { setTime(''); setTimePicker(true) }}>Add task</button>
      {timePicker && <TaskDialog title="Choose a time" close={() => setTimePicker(false)}>
        <form className="task-form" onSubmit={event => {
          event.preventDefault()
          setTimePicker(false)
          setTask({ value: { ...emptyTask(today), scheduleId: editing.id, allDay: false, startTime: time, alertNotify: true, reminders: [0] } })
        }}><label>Start time<input type="time" required value={time} onChange={event => setTime(event.target.value)} /></label>
          <button className="primary">Continue</button></form>
      </TaskDialog>}
    </>}
    {task && <TaskForm title={task.id ? 'Edit task' : 'Add task'} initial={task.value} editing={!!task.id} busy={actions.busy}
      close={() => setTask(undefined)} save={value => void actions.save(value, 0, task.id, undefined, () => setTask(undefined))} />}
  </section>

  return <section className="task-grid">
    <AppBar title="Schedules" back={() => void navigate('/more')} />
    <button className="primary" onClick={() => open('new')}>Create a schedule</button>
    {loadError && <p role="alert">Schedules could not be loaded.</p>}
    {error && !copying && <p role="alert">{error}</p>}
    {rows.map((row, index) => <article className={'task-card task-color-' + row.color} key={row.id}>
      <h2><TaskIcon name={row.icon} /> {row.name}</h2>
      <p><span className="schedule-day-dots" role="img" aria-label={row.days.map(day => weekdays[day]).join(' and ')}>
        {[1, 2, 3, 4, 5, 6, 0].map(day => <span key={day} aria-hidden data-active={row.days.includes(day)}>{weekdays[day][0]}</span>)}</span> · {groups.filter(group => group.task.scheduleId === row.id).length} tasks {row.paused && <span className="task-chip">Paused</span>}</p>
      <div className="task-actions">
        <button className="secondary" onClick={() => setMenu(row)}>Options for {row.name}</button>
        {[-1, 1].map(direction => {
          const Icon = direction < 0 ? ArrowUp : ArrowDown
          return <button className="icon-button" aria-label={direction < 0 ? 'Move up' : 'Move down'} key={direction} disabled={busy || !rows[index + direction]}
            onClick={() => void run(async () => { await moveSchedule(row.id, direction) })}><Icon size={inlineIconSize} aria-hidden /></button>
        })}
      </div>
    </article>)}
    {menu && <TaskDialog title={menu.name} close={() => setMenu(undefined)}><div className="task-form">
      <button className="secondary" onClick={() => open(menu)}>Edit</button>
      <button className="secondary" onClick={() => { setCopying(menu); setDraft({ ...draftOf(menu), name: menu.name.slice(0, 33) + ' (copy)', days: [] }); setMenu(undefined); setError('') }}>Duplicate</button>
      <button className="secondary" disabled={busy} onClick={() => void run(async () => {
        await saveSchedule({ ...draftOf(menu), paused: !menu.paused }, menu.id)
        setMenu(undefined)
      })}>{menu.paused ? 'Resume' : 'Pause'}</button>
      <button className="secondary" disabled={busy} onClick={() => void run(async () => {
        const undo = await deleteSchedule(menu.id)
        setMenu(undefined)
        notify({ message: 'Schedule deleted.', action: { label: 'Undo', run: undo } })
      })}>Delete</button>
    </div></TaskDialog>}
    {copying && <TaskDialog title="Duplicate schedule" close={() => setCopying(undefined)}>
      <form className="task-form" onSubmit={event => {
        event.preventDefault()
        void run(async () => {
          const { undo } = await duplicateSchedule(copying.id, draft.name, draft.days)
          setCopying(undefined)
          notify({ message: 'Schedule duplicated.', action: { label: 'Undo', run: undo } })
        })
      }}><label>Name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <ScheduleDays days={draft.days} setDays={days => setDraft({ ...draft, days })} />
        {error && <p role="alert">{error}</p>}<button className="primary" disabled={busy}>Duplicate</button></form>
    </TaskDialog>}
  </section>
}
