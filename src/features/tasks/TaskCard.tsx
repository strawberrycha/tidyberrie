import { AlarmClock, Bell, ChevronDown, ArrowDown, ArrowUp, Check, CalendarArrowDown, CircleAlert, Ellipsis, Minus, Pin, Repeat2, RotateCcw } from 'lucide-react'
import { monthFirstDate } from '../../shared/utils/dateFormat'
import { useTaskGesture } from './useTaskGesture'
import { barIconSize, inlineIconSize } from '../../app/uiTokens'
import { useId, useState } from 'react'
import { alarmMode } from './scheduleInput'
import { statusLabels } from './input'
import { overdue } from './lists'
import { progress } from './model'
import type { TaskRow } from './model'
import type { Records } from '../../shared/db/schemas'
import { localDate } from './recurrence'

const priorityIcons = { low: ArrowDown, medium: Minus, high: ArrowUp }

const expandedRows = new Set<string>()

export function TaskCard({ row, now, canComplete, disabled, edit, remove, check, schedule, menu, selection, select, swipe, move, timeFormat, next, addSubtask, compact }: {
  schedule?: Records['schedules']; timeFormat?: '12h' | '24h'; next?: boolean; compact?: boolean; addSubtask?: (title: string) => void; row: TaskRow; now: Date; canComplete: boolean; disabled: boolean; edit?: () => void; remove?: () => void;
  check: (done: boolean, subtaskId?: string) => void; menu?: () => void;
  selection?: boolean; select?: () => void; swipe?: (action: 'done' | 'reschedule') => void; move?: (days: number) => void
}) {
  const key = row.group.task.id
  const [expanded, setExpanded] = useState(() => expandedRows.has(key))
  const [subtask, setSubtask] = useState('')
  const panel = useId()
  const value = row.value
  const count = progress(value.subtasks)
  const done = value.status === 'done'
  const formatted = value.startTime && !value.allDay ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: timeFormat !== '24h' }).format(new Date(value.startDate + 'T' + value.startTime)) : 'All day'
  const date = localDate(now)
  const time = [now.getHours(), now.getMinutes()].map(unit => String(unit).padStart(2, '0')).join(':')
  const Priority = priorityIcons[value.priority]
  const { drag, consumeClick, ...gesture } = useTaskGesture({ disabled: disabled || selection !== undefined || expanded || !select, select, swipe })
  const Reveal = drag > 0 ? done ? RotateCcw : Check : CalendarArrowDown
  return <div className="task-gesture" data-swipe-enabled={!!swipe && selection === undefined && !expanded} data-dragging={drag !== 0}
    {...gesture} onClickCapture={event => {
      if (consumeClick()) { event.preventDefault(); event.stopPropagation() }
    }} onClick={event => {
      if (selection !== undefined && !(event.target as Element).closest('label, input')) select?.()
      else if (selection === undefined && !(event.target as Element).closest('button, label, input, form')) edit?.()
    }}>
    {drag !== 0 && <div className="task-swipe-reveal" data-direction={drag > 0 ? 'right' : 'left'} aria-hidden>
      <Reveal size={inlineIconSize} /> {drag > 0 ? done ? 'To do' : 'Done' : 'Reschedule'}
    </div>}
    <article style={drag ? { transform: 'translateX(' + drag + 'px)' } : undefined}
      role={selection === undefined ? undefined : 'row'} aria-selected={selection} className={'task-card task-row task-color-' + (schedule?.color || value.color || 'rose')} data-complete={done} data-skipped={value.status === 'skipped'} data-compact={compact || undefined}>
    <div role={selection === undefined ? undefined : 'gridcell'}>
    <div className="task-row-heading">
      <span className="task-row-time">{formatted}</span>
      <span className="task-row-alerts">
        {(value.scheduleId ? value.alertNotify : value.reminders.length > 0) && <Bell size={barIconSize} role="img" aria-label="Notification on" />}
        {alarmMode && value.alertAlarm && <AlarmClock size={barIconSize} role="img" aria-label="Alarm on" />}
      </span>
      <div className="task-row-title">
        <h2>{edit && selection === undefined ? <button type="button" className="task-row-open" onClick={edit}>{value.title}</button> : value.title}</h2>
        {schedule && <p className="task-row-schedule"><span className="task-schedule-dot" aria-hidden /> {schedule.name}</p>}
      </div>
      {selection === undefined && !!count.total && <button className="secondary task-row-progress" type="button" aria-label={'Subtasks ' + count.done + '/' + count.total}
        aria-expanded={expanded} aria-controls={panel} onClick={() => {
          if (expanded) expandedRows.delete(key)
          else expandedRows.add(key)
          setExpanded(!expanded)
        }}>{count.done}/{count.total}<ChevronDown size={inlineIconSize} aria-hidden /></button>}
      {selection !== undefined && <label className="task-selection-check"><input type="checkbox" aria-label={'Select ' + value.title}
        checked={selection} onChange={select} /></label>}
      {selection === undefined && canComplete && <label className="task-selection-check">
        <input type="checkbox" checked={done} disabled={disabled} aria-label={done ? 'Done · Reopen ' + value.title : 'Complete ' + value.title}
          onChange={event => check(event.target.checked)} />
      </label>}
    </div>
    <div className="task-chips">
      {next && <span className="task-chip">Next</span>}
      {value.optional && <span className="task-chip">Optional</span>}
      {!compact && <span className="task-chip"><Priority size={16} data-testid="priority-icon" aria-hidden /> {value.priority} priority</span>}
      {row.group.task.repeatRule && <span className="task-chip"><Repeat2 size={16} aria-hidden /> Repeats</span>}
      {value.pinned && <span className="task-chip"><Pin size={16} aria-hidden /> Pinned</span>}
      {(!row.group.task.repeatRule || row.occurrence) && !value.optional && overdue(value, date, time) && <span className="task-chip"><CircleAlert size={16} aria-hidden /> Overdue</span>}
      {value.status !== 'todo' && !done && <span className="task-chip">{statusLabels[value.status]}</span>}
      {value.status === 'postponed' && value.originalDate && <span className="task-chip"><RotateCcw size={inlineIconSize} aria-hidden /> Postponed from {monthFirstDate(value.originalDate, { weekday: 'short', month: 'short', day: 'numeric' })}</span>}
      {done && <span className="task-chip"><Check size={16} aria-hidden /> Completed</span>}
      {value.tag && <span className="task-chip">{value.tag}</span>}
    </div>
    {value.description && <p className="task-description">{value.description}</p>}
    {selection === undefined && !!count.total && <div className="task-row-subtasks" id={panel} data-expanded={expanded}>
      <div inert={!expanded} aria-hidden={!expanded}><ul>{value.subtasks.map(item => <li key={item.id}>
        <label className="task-check"><input type="checkbox" checked={item.done} disabled={disabled || !canComplete} onChange={event => check(event.target.checked, item.id)} />
          {item.title}{item.dueTime && <span className="task-due">{item.dueTime}</span>}
        </label>
      </li>)}</ul>
      {addSubtask && <form className="task-actions" onSubmit={event => {
        event.preventDefault()
        if (subtask.trim()) { addSubtask(subtask.trim()); setSubtask('') }
      }}><input aria-label="Add subtask" placeholder="+ Add subtask" value={subtask} maxLength={120} onChange={event => setSubtask(event.target.value)} />
        <button className="secondary" disabled={disabled || !subtask.trim()}>Add</button></form>}
      </div>
    </div>}
    {selection === undefined && move && <div className="task-actions">{['Today', 'Tomorrow'].map((name, index) =>
      <button className="secondary" key={name} type="button" disabled={disabled} onClick={() => move(index)}>
        <CalendarArrowDown size={inlineIconSize} aria-hidden /> {name}</button>)}</div>}
    {selection === undefined && (remove || menu) && <div className="task-actions">
      {menu && <button className="icon-button" type="button" aria-label={'Actions for ' + value.title} disabled={disabled} onClick={menu}><Ellipsis aria-hidden /></button>}
      {remove && <button className="secondary" type="button" disabled={disabled} onClick={remove}>Delete</button>}
    </div>}
    </div>
    </article>
  </div>
}
