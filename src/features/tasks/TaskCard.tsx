import { ArrowDown, ArrowUp, Check, CircleAlert, Ellipsis, Minus, Pin, Repeat2, RotateCcw } from 'lucide-react'
import { inlineIconSize } from '../../app/uiTokens'
import { useId, useState } from 'react'
import { TaskIcon } from './icons'
import { statusLabels } from './input'
import { overdue } from './lists'
import { progress } from './model'
import type { TaskRow } from './model'
import type { Records } from '../../shared/db/schemas'
import { localDate } from './recurrence'

const priorityIcons = { low: ArrowDown, medium: Minus, high: ArrowUp }

export function TaskCard({ row, now, canComplete, disabled, edit, remove, check, category, menu }: {
  category?: Records['categories']; row: TaskRow; now: Date; canComplete: boolean; disabled: boolean; edit?: () => void; remove?: () => void;
  check: (done: boolean, subtaskId?: string) => void; menu?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const panel = useId()
  const value = row.value
  const count = progress(value.subtasks)
  const done = value.status === 'done'
  const date = localDate(now)
  const time = [now.getHours(), now.getMinutes()].map(unit => String(unit).padStart(2, '0')).join(':')
  const Priority = priorityIcons[value.priority]
  return <article className={'task-card task-color-' + (value.color || (category && !category.archived ? category.color : 'rose'))} data-complete={done}>
    <div className="task-card-heading">
      <span className="task-glyph"><TaskIcon name={category?.icon ?? value.icon} /></span>
      <div>
        <h2>{value.title}</h2>
        <p><time dateTime={value.startDate}>{value.startDate}</time>{value.allDay ? ' · All day' : value.startTime
          ? ' · ' + value.startTime + (value.endTime ? '–' + value.endTime : '') : ''}</p>
      </div>
      {canComplete && <button className="icon-button task-complete" type="button" disabled={disabled}
        aria-label={done ? 'Reopen ' + value.title : 'Complete ' + value.title} onClick={() => check(!done)}>
        {done ? <RotateCcw size={20} aria-hidden /> : <Check size={20} aria-hidden />}
      </button>}
    </div>
    <div className="task-chips">
      <span className="task-chip">{category ? category.name + (category.archived ? ' (archived)' : '') : 'Uncategorized'}</span>
      {value.optional && <span className="task-chip">Optional</span>}
      {value.estimateMinutes !== null && <span className="task-chip">Est {value.estimateMinutes}m</span>}
      {value.actualMinutes !== null && <span className="task-chip">Took {value.actualMinutes}m</span>}
      <span className="task-chip"><Priority size={16} data-testid="priority-icon" aria-hidden /> {value.priority} priority</span>
      {row.group.task.repeatRule && <span className="task-chip"><Repeat2 size={16} aria-hidden /> Repeats</span>}
      {value.pinned && <span className="task-chip"><Pin size={16} aria-hidden /> Pinned</span>}
      {(!row.group.task.repeatRule || row.occurrence) && !value.optional && overdue(value, date, time) && <span className="task-chip"><CircleAlert size={16} aria-hidden /> Overdue</span>}
      {value.status !== 'todo' && !done && <span className="task-chip">{statusLabels[value.status]}</span>}
      {value.status === 'postponed' && value.originalDate && <span className="task-chip"><RotateCcw size={inlineIconSize} aria-hidden /> Postponed from {new Date(value.originalDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>}
      {done && <span className="task-chip"><Check size={16} aria-hidden /> Completed</span>}
      {value.tag && <span className="task-chip">{value.tag}</span>}
    </div>
    {value.description && <p className="task-description">{value.description}</p>}
    {!!count.total && <div className="task-progress">
      <label className="task-progress-label"><span>Subtasks {count.done}/{count.total}</span><progress value={count.done} max={count.total} /></label>
      <button className="secondary" type="button" aria-expanded={expanded} aria-controls={panel} onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide subtasks' : 'Show subtasks'}</button>
      <ul id={panel} hidden={!expanded}>{value.subtasks.map(item => <li key={item.id}>
        <label className="task-check"><input type="checkbox" checked={item.done} disabled={disabled || !canComplete} onChange={event => check(event.target.checked, item.id)} />
          {item.title}{item.dueTime && <span className="task-due">{item.dueTime}</span>}
        </label>
      </li>)}</ul>
    </div>}
    {(edit || remove || menu) && <div className="task-actions">
      {edit && <button className="secondary" type="button" disabled={disabled} onClick={edit}>Edit</button>}
      {menu && <button className="icon-button" type="button" aria-label={'Actions for ' + value.title} disabled={disabled} onClick={menu}><Ellipsis aria-hidden /></button>}
      {remove && <button className="secondary" type="button" disabled={disabled} onClick={remove}>Delete</button>}
    </div>}
  </article>
}
