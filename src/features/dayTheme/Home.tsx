import { features } from '../../app/features'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListTodo } from 'lucide-react'
import { HomeBudget } from '../budget/HomeBudget'
import { EmptyIllustration } from '../../shared/ui/EmptyState'
import { dateLabel, localDate, weekdayOf } from '../calendar/dates'
import { PlannerAddButton, PlannerTaskList, QuickAdd } from '../calendar/PlannerTasks'
import { emptyDay } from '../calendar/taskWindow'
import { useCalendarData, useLocalClock } from '../calendar/useCalendarData'
import { Avatar } from './Avatar'
import { DayThemeBadge } from './DayThemeBadge'
import { dashboardSummary } from './dashboard'
import { resolveDayTheme } from './model'
import { useDayThemes } from './useDayThemes'
import '../tasks/tasks.css'
import '../calendar/planner.css'

export function Home() {
  const now = useLocalClock()
  const today = localDate(now)
  const [draft, setDraft] = useState<string>()
  const data = useCalendarData({ from: today, through: today })
  const themes = useDayThemes(features.dayTheme)
  const theme = resolveDayTheme(themes.index, today, weekdayOf(today))
  const day = data.days.get(today) ?? emptyDay
  const { done, next, overdue, mood } = useMemo(() => dashboardSummary(day.rows, data.groups, now), [day, data.groups, now])
  const total = day.rows.length
  const circumference = 2 * Math.PI * 38
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return <div className="planner-view">
    <section className="planner-card planner-greeting">
      <div><h2>{greeting}</h2><p><time dateTime={today}>{dateLabel(today)}</time></p></div>
      {features.dayTheme && <DayThemeBadge theme={theme} />}
      <Avatar mood={mood} evening={now.getHours() >= 18} />
    </section>
    {data.error && <p role="alert">Could not load today’s tasks.</p>}
    {features.dayTheme && themes.error && <p role="alert">Could not load Day Themes.</p>}
    {data.loading && <p role="status">Loading today’s tasks…</p>}
    <div className="planner-home-grid">
      <section className="planner-card planner-progress">
        <h2>Today’s progress</h2>
        <div className="planner-ring">
          <svg viewBox="0 0 96 96" aria-hidden="true">
            <circle className="planner-ring-track" cx="48" cy="48" r="38" />
            {done > 0 && <circle className="planner-ring-value" cx="48" cy="48" r="38" strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - done / total)} />}
          </svg>
        </div>
        <p role="status">{done} of {total} done</p>
        {features.tasks && <Link className="secondary" to="/tasks?list=Overdue">{overdue} overdue</Link>}
      </section>
      <section className="planner-card">
        <h2>Next up</h2>
        {next ? <div><strong>{next.value.title}</strong><p>{next.value.allDay || !next.value.startTime ? 'Any time today' : next.value.startTime}</p></div>
          : <p>No upcoming tasks today.</p>}
      </section>
    </div>
    <section className="planner-card">
      <h2>Today’s tasks</h2>
      {!total && !data.loading && <div className="planner-empty"><EmptyIllustration icon={ListTodo} sticker="check" /><p>Nothing planned today.</p></div>}
      <PlannerTaskList key={today} rows={day.rows} now={now} />
    </section>
    {features.budget && <HomeBudget today={today} />}
    {features.tasks && <PlannerAddButton open={() => setDraft(today)} />}
    {features.tasks && draft && <QuickAdd draft={{ date: draft }} close={() => setDraft(undefined)} />}
  </div>
}
