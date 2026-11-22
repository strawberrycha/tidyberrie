import { features } from '../../app/features'
import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { EmptyIllustration } from '../../shared/ui/EmptyState'
import { useTheme } from '../../shared/theme/ThemeProvider'
import { DayThemeBadge } from '../dayTheme/DayThemeBadge'
import { assignmentValue, ThemeOptions } from '../dayTheme/DayThemeSettings'
import { resolveDayTheme } from '../dayTheme/model'
import { useDayThemes, useDayThemeActions } from '../dayTheme/useDayThemes'
import { TaskDialog } from '../tasks/TaskDialog'
import { calendarViews, dateLabel, localDate, localTime, stepView, visibleWindow, weekdayOf, windowDates } from './dates'
import type { CalendarView } from './dates'
import { MonthGrid } from './MonthGrid'
import { PlannerAddButton, PlannerTaskList, QuickAdd } from './PlannerTasks'
import type { QuickDraft } from './PlannerTasks'
import { emptyDay, summaryText } from './taskWindow'
import type { DaySummary } from './taskWindow'
import { useCalendarData, useLocalClock } from './useCalendarData'
import '../tasks/tasks.css'
import './planner.css'

const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))

function DayTimeline({ day, now, today, quick }: {
  day: DaySummary; now: Date; today: boolean; quick: (time?: string) => void
}) {
  const untimed = day.rows.filter(row => row.value.allDay || !row.value.startTime)
  return <div className="planner-day">
    <section className="planner-card">
      <h3>All day</h3>
      {untimed.length ? <PlannerTaskList rows={untimed} now={now} />
        : <div className="planner-empty"><EmptyIllustration icon={CalendarDays} sticker="journal" /><p>No all-day tasks.</p></div>}
    </section>
    <ol className="planner-hours" aria-label="Hours">
      {hours.map((hour, index) => {
        const time = hour + ':00'
        const rows = day.rows.filter(row => !row.value.allDay && row.value.startTime.startsWith(hour))
        const minutes = now.getMinutes()
        return <li className="planner-hour" key={hour}>
          <time dateTime={time}>{time}</time>
          <div>
            {today && now.getHours() === index && <div className="planner-now">
              <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
                <line x1="0" y1={minutes} x2="100" y2={minutes} vectorEffect="non-scaling-stroke" />
              </svg>
              <span>Now {localTime(now)}</span>
            </div>}
            {rows.length ? <PlannerTaskList rows={rows} now={now} />
              : features.tasks && <button type="button" className="planner-slot" aria-label={'Add task at ' + time} onClick={() => quick(time)}>+</button>}
          </div>
        </li>
      })}
    </ol>
  </div>
}

export function Calendar() {
  const now = useLocalClock()
  const today = localDate(now)
  const [selected, select] = useState<string>()
  const [view, setView] = useState<CalendarView>('Month')
  const [activeDay, setActiveDay] = useState<string>()
  const [changeTheme, setChangeTheme] = useState(false)
  const [draft, setDraft] = useState<QuickDraft>()
  const { preferences } = useTheme()
  const themes = useDayThemes(features.dayTheme)
  const actions = useDayThemeActions()
  const anchor = selected ?? today
  const window = visibleWindow(view, anchor, preferences?.weekStart ?? 1)
  const data = useCalendarData(window)
  const themeFor = (date: string) => features.dayTheme ? resolveDayTheme(themes.index, date, weekdayOf(date)) : undefined
  const heading = view === 'Month' ? dateLabel(anchor, { month: 'long', year: 'numeric' })
    : view === 'Day' ? dateLabel(anchor)
      : dateLabel(window.from, { month: 'short', day: 'numeric' }) + ' – ' + dateLabel(window.through, { month: 'short', day: 'numeric', year: 'numeric' })

  function open(date: string) {
    setActiveDay(date)
    setChangeTheme(false)
  }

  return <div className="planner-view">
    <nav className="planner-tabs smart-lists" aria-label="Calendar views">{calendarViews.map(value =>
      <button type="button" key={value} aria-pressed={value === view} onClick={() => setView(value)}>{value}</button>)}</nav>
    <div className="planner-controls">
      <h2 aria-live="polite">{heading}</h2>
      <div className="task-actions">
        <button type="button" className="secondary" onClick={() => select(undefined)}>Today</button>
        <button type="button" className="icon-button" aria-label={'Previous ' + view.toLowerCase()}
          onClick={() => select(stepView(view, anchor, -1))}><ChevronLeft aria-hidden /></button>
        <button type="button" className="icon-button" aria-label={'Next ' + view.toLowerCase()}
          onClick={() => select(stepView(view, anchor, 1))}><ChevronRight aria-hidden /></button>
      </div>
    </div>
    {data.error && <p role="alert">Could not load calendar tasks.</p>}
    {features.dayTheme && themes.error && <p role="alert">Could not load Day Themes.</p>}
    {data.loading && <p role="status">Loading calendar tasks…</p>}
    {(view === 'Month' || view === 'Week') && <MonthGrid window={window} anchor={anchor} today={today}
      days={data.days} themeFor={themeFor} move={select} open={open} week={view === 'Week'} />}
    {view === 'Day' && <>
      <button type="button" className="secondary planner-date-link" onClick={() => open(anchor)}>Day details</button>
      <DayTimeline key={anchor} day={data.days.get(anchor) ?? emptyDay} now={now} today={anchor === today}
        quick={time => setDraft({ date: anchor, time })} />
    </>}
    {view === 'Agenda' && <ol className="planner-agenda">{windowDates(window).map(date => {
      const day = data.days.get(date) ?? emptyDay
      return <li key={date} className="planner-card">
        <button type="button" className="secondary planner-date-link" aria-current={date === today ? 'date' : undefined}
          onClick={() => open(date)}>{dateLabel(date)} · {summaryText(day)}</button>
        {day.rows.length > 0 && <PlannerTaskList rows={day.rows} now={now} />}
      </li>
    })}</ol>}
    {features.tasks && <PlannerAddButton open={() => setDraft({ date: anchor })} />}
    {activeDay && <TaskDialog title={dateLabel(activeDay)} side close={() => setActiveDay(undefined)}>
      <div className="planner-day-panel">
        {features.dayTheme && <DayThemeBadge theme={themeFor(activeDay)} />}
        <div className="task-actions">
          {features.dayTheme &&           <button type="button" className="secondary" aria-expanded={changeTheme}
            disabled={!themes.ready} onClick={() => setChangeTheme(!changeTheme)}>Change Day Theme</button>}
          {features.tasks && <button type="button" className="primary" data-first-field onClick={() => setDraft({ date: activeDay })}>Quick add task</button>}
        </div>
        {features.dayTheme && changeTheme && <label className="planner-theme-select">
          Theme for this date<select value={assignmentValue(themes.index.dated.get(activeDay))} disabled={actions.busy}
            onChange={event => void actions.assign({ date: activeDay }, event.target.value)}>
            <ThemeOptions catalog={themes.catalog} fallback="Use weekday default" current={themes.index.dated.get(activeDay)} />
          </select>
        </label>}
        <h3 role="status">{summaryText(data.days.get(activeDay) ?? emptyDay)}</h3>
        <PlannerTaskList key={activeDay} rows={(data.days.get(activeDay) ?? emptyDay).rows} now={now} />
      </div>
    </TaskDialog>}
    {features.tasks && draft && <QuickAdd draft={draft} close={() => setDraft(undefined)} />}
  </div>
}
