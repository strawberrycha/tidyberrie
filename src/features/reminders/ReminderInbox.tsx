import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { moreRoute } from '../../app/navigation'
import { useMinuteClock } from '../../app/useMinuteClock'
import { useTheme } from '../../shared/theme/ThemeProvider'
import { useTaskActions, useTaskGroups } from '../tasks/useTasks'
import { taskValue } from '../tasks/model'
import { localDate } from '../tasks/recurrence'
import { TaskForm } from '../tasks/TaskForm'
import { missedReminders, reminderProblem } from './reminderPresentation'
import { useReminders } from './useReminders'
import { minute, testKey } from './window'

export function ReminderInbox() {
  const reminders = useReminders()
  const { preferences } = useTheme()
  const now = useMinuteClock()
  const [tab, setTab] = useState<'Missed' | 'Upcoming'>('Missed')
  const [limit, setLimit] = useState(20)
  const [opened, open] = useState<ReturnType<typeof reminders.taskTarget>>()
  const groups = useTaskGroups(false)
  const actions = useTaskActions()
  const id = useId()
  const tabs = useRef<HTMLDivElement>(null)
  const missed = missedReminders(reminders.due)
  const upcoming = (reminders.pending ?? []).filter(item =>
    item.key !== testKey && item.at > +now && item.at <= +now + 24 * 60 * minute)
  const problem = reminderProblem(reminders.status, reminders.platform, reminders.error)
  const group = opened && groups?.groups?.find(item => item.task.id === opened.id)
  const occurrence = group?.task.repeatRule || group?.task.scheduleId ? opened?.date : undefined
  const format = (at: number) => new Date(at).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: preferences?.timeFormat !== '24h',
  })

  return <div className="settings-grid reminder-inbox">
    <div ref={tabs} className="task-list-chips wide" role="tablist" aria-label="Reminder lists"
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const next = event.key === 'Home' ? 'Missed' : event.key === 'End' ? 'Upcoming' : tab === 'Missed' ? 'Upcoming' : 'Missed'
        setTab(next)
        tabs.current?.querySelector<HTMLButtonElement>('[data-tab="' + next + '"]')?.focus()
      }}>
      {(['Missed', 'Upcoming'] as const).map(name => <button type="button" role="tab" key={name} data-tab={name}
        id={id + name} aria-controls={id + name + '-panel'} aria-selected={tab === name}
        tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)}><span>{name}</span></button>)}
    </div>
    <section className="settings-card wide" role="tabpanel" id={id + 'Missed-panel'} aria-labelledby={id + 'Missed'} hidden={tab !== 'Missed'}>
      {!missed.length && <p>You’re all caught up</p>}
      {!!missed.length && <ul className="task-grid">{missed.slice(0, limit).map(item => {
        const target = reminders.taskTarget(item.key)
        return <li key={item.key} className="settings-card">
          <h2>{item.title}</h2>
          <p><time dateTime={new Date(item.at).toISOString()}>{format(item.at)}</time>{item.scheduleName && ' · ' + item.scheduleName}</p>
          <div className="task-actions">
            {target && <button className="secondary" disabled={reminders.busy} onClick={() => void reminders.done(item)}>Done</button>}
            <button className="secondary" disabled={reminders.busy} onClick={() => void reminders.dismiss(item)}>Dismiss</button>
            {target && <button className="secondary" disabled={!groups?.groups?.some(item => item.task.id === target.id)} onClick={() => open(target)}>Open</button>}
          </div>
          <details className="reminder-help"><summary>Snooze</summary>
            <div className="task-actions">{([
              ['10-minutes', '10 minutes'], ['1-hour', '1 hour'], ['tomorrow', 'Until tomorrow'],
            ] as const).map(([choice, label]) => <button className="secondary" key={choice} disabled={reminders.busy}
              onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); void reminders.snooze(item, choice) }}>{label}</button>)}</div>
          </details>
        </li>
      })}</ul>}
      {missed.length > limit && <button className="secondary" onClick={() => setLimit(limit + 20)}>Show more reminders</button>}
    </section>
    <section className="settings-card wide" role="tabpanel" id={id + 'Upcoming-panel'} aria-labelledby={id + 'Upcoming'} hidden={tab !== 'Upcoming'}>
      {!upcoming.length && <p>No reminders in the next 24 hours</p>}
      {!!upcoming.length && <ul className="task-grid">{upcoming.map((item, index) => <li key={item.key ?? index}>
        <time dateTime={new Date(item.at).toISOString()}>{format(item.at)}</time> · {item.title}{item.scheduleName && ' · ' + item.scheduleName}
      </li>)}</ul>}
      {problem ? <p>{problem}.</p> : reminders.cappedThrough &&
        <p>Reminders are scheduled through {format(reminders.cappedThrough)}. Open the app to extend.</p>}
    </section>
    <Link className="secondary settings-link wide" to={moreRoute('reminders')}>Reminder settings</Link>
    {opened && group && <TaskForm title="Task details" initial={taskValue(group, localDate(now), occurrence)} editing occurrence={!!occurrence}
      busy={actions.busy} close={() => open(undefined)}
      save={value => void actions.save(value, preferences?.weekStart ?? 0, opened.id, occurrence, () => open(undefined))} />}
  </div>
}
