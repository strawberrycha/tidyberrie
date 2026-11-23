import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CircleAlert, ListTodo, PartyPopper, Moon, Sun, Sunset } from 'lucide-react'
import { features } from '../../app/features'
import { moreRoute } from '../../app/navigation'
import { useMinuteClock } from '../../app/useMinuteClock'
import { useTheme } from '../../shared/theme/ThemeProvider'
import { EmptyIllustration } from '../../shared/ui/EmptyState'
import { dateLabel, localDate, visibleWindow, windowDates } from '../calendar/dates'
import { PlannerAddButton, QuickAdd } from '../calendar/PlannerTasks'
import { emptyDay, summarizeTasks } from '../calendar/taskWindow'
import { useCalendarData } from '../calendar/useCalendarData'
import { defaultRepeat, addDays } from '../tasks/recurrence'
import { TaskDialog } from '../tasks/TaskDialog'
import { TaskForm } from '../tasks/TaskForm'
import { useTaskActions } from '../tasks/useTasks'
import type { TaskRow } from '../tasks/model'
import { isOpen, taskValue } from '../tasks/model'
import { useReminders } from '../reminders/useReminders'
import { Avatar } from './Avatar'
import { newSubtask } from '../tasks/input'
import { TaskCard } from '../tasks/TaskCard'
import { dailyQuote, greeting, openPlan, relativeTime } from './model'
import { BillLine, BudgetQuickEditor, HomeBudgetSummary, useHomeBudget } from './BudgetSummary'
import '../tasks/tasks.css'
import '../calendar/planner.css'

const brief = { weekday: 'short', month: 'short', day: 'numeric' } as const
type BudgetState = ReturnType<typeof useHomeBudget>

export function Home({ overdue = 0 }: { overdue?: number }) {
  const now = useMinuteClock()
  const today = localDate(now)
  const [selection, select] = useState<{ date: string; today: string }>()
  const selected = selection?.today === today ? selection.date : today
  if (features.budget) return <HomeWithBudget now={now} today={today} selected={selected} overdue={overdue}
    select={date => select({ date, today })} />
  return <HomePlan now={now} today={today} selected={selected} overdue={overdue} select={date => select({ date, today })} />
}

type HomeProps = { now: Date; today: string; selected: string; overdue: number; select: (date: string) => void }

function HomeWithBudget(props: HomeProps) {
  const budget = useHomeBudget(props.today, props.selected)
  return <HomePlan {...props} budget={budget} />
}

function HomePlan({ now, today, selected, overdue, select, budget }: HomeProps & { budget?: BudgetState }) {
  const { preferences } = useTheme()
  const { status, platform } = useReminders()
  const [retry, setRetry] = useState(0)
  const problem = status?.notifications === 'denied' ? 'Reminders are off'
    : status?.exact === 'denied' ? 'Exact alarms are off'
    : [status?.notifications, status?.exact].includes('error') ? 'Could not check reminders'
    : [status?.notifications, status?.exact].includes('unknown') ? 'Reminder status is unknown'
    : platform === 'android' && status?.notifications === 'unavailable' ? 'Reminders are unavailable'
    : undefined
  return <div className="home-view">
    <header className="home-top">
      <h1><img src="/icon-192.png" alt="" width="32" height="32" />Tidyberrie</h1>
      <time dateTime={now.toISOString()}>{new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: preferences?.timeFormat !== '24h' }).format(now)}</time>
    </header>
    {problem && <Link className="home-reminder" to={moreRoute('reminders')}><CircleAlert size={18} aria-hidden />{problem} – Fix</Link>}
    <HomeContent key={retry} now={now} today={today} selected={selected} select={select} overdue={overdue}
      budget={budget} retry={() => setRetry(count => count + 1)} />
  </div>
}

function HomeContent({ now, today, selected, select, overdue, budget, retry }: HomeProps & { budget?: BudgetState; retry: () => void }) {
  const { preferences } = useTheme()
  const actions = useTaskActions()
  const [dialog, setDialog] = useState<'task' | 'quick' | TaskRow | { kind: 'expenses' | 'incomes'; id?: string }>()
  const [hiddenAmounts, setHiddenAmounts] = useState(() => localStorage.getItem('tidyberrie-home-hide-amounts') === 'true')
  const week = visibleWindow('Week', selected, preferences?.weekStart ?? 0)
  const data = useCalendarData(week)
  const day = data.days.get(selected) ?? emptyDay
  const currentDay = data.days.get(today) ?? emptyDay
  const counted = day.rows.filter(row => row.value.status !== 'skipped').length
  const currentCounted = currentDay.rows.filter(row => row.value.status !== 'skipped').length
  const isToday = selected === today
  const open = useMemo(() => openPlan(day.rows), [day.rows])
  const upcoming = useMemo(() => {
    const dates = { from: addDays(selected, 1), through: addDays(selected, 3) }
    const rows = [...summarizeTasks(data.groups, dates).entries()].flatMap(([date, day]) =>
      day.rows.filter(({ value }) => isOpen(value.status)).map(row => ({ date, label: row.value.title, row })))
    const bills = (budget?.model?.upcoming ?? []).map(bill => ({ date: bill.date, label: bill.category, bill }))
    return [...rows, ...bills].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
  }, [data.groups, selected, budget?.model?.upcoming])
  const [choosingScope, setChoosingScope] = useState(false)
  const close = () => { setDialog(undefined); setChoosingScope(false) }
  const openRow = (row: TaskRow) => { setChoosingScope(!!(row.value.scheduleId && row.occurrence)); setDialog(row) }
  const month = dateLabel(selected, { month: 'long', year: 'numeric' })
  const allDone = counted > 0 && !open.length
  const hour = now.getHours()
  const GreetingIcon = hour < 5 || hour >= 21 ? Moon : hour >= 17 ? Sunset : Sun
  const openBill = (id: string) => setDialog({ kind: 'expenses', id })
  const openQuick = () => setDialog(features.budget ? 'quick' : 'task')
  return <>
    <section className="home-card home-greeting">
      <Avatar mood={currentCounted > 0 && currentDay.done === currentCounted ? 'all' : overdue >= 3 ? 'overdue' : 'none'}
        evening={hour >= 21 || hour < 5} />
      <div className="greeting-copy"><h2><GreetingIcon size={20} aria-hidden /> {greeting(hour)}, {preferences?.yourName ?? 'Cha'}{hour < 5 ? '?' : '!'}</h2>
        <p className="home-quote">{dailyQuote(today)}</p><time dateTime={today}>{dateLabel(today, { ...brief, weekday: 'long' })}</time>
      </div>
    </section>

    <section className="home-card home-week" aria-label="Week strip">
      <div className="home-heading">
        <button className="icon-button" type="button" aria-label="Previous week" onClick={() => select(addDays(selected, -7))}><ChevronLeft aria-hidden size={20} /></button>
        <h2>{features.calendar ? <Link to="/calendar">{month}</Link> : month}</h2>
        {!isToday && <button className="secondary home-today" onClick={() => select(today)}>Today</button>}
        <button className="icon-button" type="button" aria-label="Next week" onClick={() => select(addDays(selected, 7))}><ChevronRight aria-hidden size={20} /></button>
      </div>
      <div className="home-days">{windowDates(week).map(date => {
        const summary = data.days.get(date) ?? emptyDay
        const current = date === today
        const count = summary.rows.length
        const number = Number(date.slice(-2))
        const name = dateLabel(date, { weekday: preferences?.textSize && preferences.textSize >= 150 ? 'narrow' : 'short' })
        return <button type="button" key={date} aria-pressed={date === selected} aria-current={current ? 'date' : undefined}

          onClick={() => select(date)}>
          <span>{name}</span>
          <strong>{number}</strong>
          <span className="home-dots" aria-hidden>{summary.colors.map((color, index) => <i key={index} className={'task-color-' + color} />)}</span>
          {current && <small>Today</small>}
          <span className="sr-only">{dateLabel(date, { weekday: 'long', month: 'long', day: 'numeric' })}, {count} {count === 1 ? 'task' : 'tasks'}</span>
        </button>
      })}</div>
    </section>

    <section className="home-card home-plan">
      <div className="home-heading">
        <h2>{isToday ? 'Today’s Plan' : 'Plan for ' + dateLabel(selected, brief)}</h2>
        {isToday && overdue > 0 && <Link className="secondary" to="/tasks?list=Overdue"><CircleAlert aria-hidden size={16} />{overdue} overdue</Link>}
        {!isToday && <button className="secondary" onClick={() => select(today)}>Back to today</button>}
      </div>
      {data.loading ? <div className="home-skeleton" role="status" aria-label="Loading tasks" /> : data.error ?
        <div role="alert"><p>Could not load tasks.</p><button className="secondary" onClick={retry}>Retry</button></div> : <>
          {counted > 0 && <div className="home-progress"><span>{day.done} of {counted} done</span>
            <progress aria-label="Task completion" aria-valuemin={0} aria-valuemax={counted} aria-valuenow={day.done} max={counted} value={day.done} /></div>}
          {!day.rows.length && <div className="planner-empty">
            <EmptyIllustration icon={ListTodo} sticker="check" />
            <p>{isToday ? 'Nothing planned today' : 'Nothing planned for this day'}</p>
            <button className="primary" onClick={() => setDialog('task')}>Add a task</button>
          </div>}
          {allDone && <div className="planner-empty"><EmptyIllustration icon={PartyPopper} sticker="celebration" />
            <p>All done! Enjoy your day</p></div>}
          {open.slice(0, 3).map((row, index) => {
            const { value, group, occurrence } = row
            const next = isToday && index === 0
            return <div key={group.task.id + '/' + (occurrence ?? '')}>
              {next && <span className="home-next">Next up · {relativeTime(value.startTime, now)}</span>}
              <TaskCard row={row} now={now} compact next={next} schedule={group.schedule} timeFormat={preferences?.timeFormat}
                canComplete disabled={actions.busy} edit={() => openRow(row)}
                addSubtask={title => void actions.save({ ...value, subtasks: [...value.subtasks, { ...newSubtask(), title }] }, preferences?.weekStart ?? 0, group.task.id, occurrence, () => {})}
                check={(done, child) => void actions.check(group.task.id, occurrence, done, child)} />
            </div>
          })}
          {open.length > 3 && <Link className="secondary settings-link" to={'/tasks?list=' + (isToday ? 'Today' : 'Upcoming')}>
            Show {open.length - 3} more</Link>}
        </>}
    </section>

    {budget && <HomeBudgetSummary today={today} budget={budget} openBill={openBill} hidden={hiddenAmounts} toggle={() => {
      setHiddenAmounts(!hiddenAmounts)
      localStorage.setItem('tidyberrie-home-hide-amounts', String(!hiddenAmounts))
    }} />}
    {upcoming.length > 0 && <section className="home-card"><h2>Coming up</h2>
      {upcoming.map((item, index) => <BillLine key={item.date + '/' + index} name={item.label} date={item.date}
        open={() => 'row' in item ? openRow(item.row) : openBill(item.bill.id)} />)}
    </section>}

    <PlannerAddButton open={openQuick} label={features.budget ? 'Quick add' : 'Add task'} />
    {dialog === 'task' && <QuickAdd draft={{ date: selected < today ? today : selected }} close={close} />}
    {dialog === 'quick' && <TaskDialog title="Quick add" close={close}>
      <div className="home-quick-actions">
        <button className="primary" onClick={() => setDialog('task')}>New task</button>
        <button className="secondary" onClick={() => setDialog({ kind: 'expenses' })}>New expense</button>
        <button className="secondary" onClick={() => setDialog({ kind: 'incomes' })}>New income</button>
      </div>
    </TaskDialog>}
    {typeof dialog === 'object' && 'group' in dialog && choosingScope && <TaskDialog title="Edit scheduled task" close={close}>
      <div className="task-form">
        <button className="primary" onClick={() => { setDialog({ group: dialog.group, value: taskValue(dialog.group, today) }); setChoosingScope(false) }}>All days of this schedule</button>
        <button className="secondary" onClick={() => setChoosingScope(false)}>This day only</button>
      </div>
    </TaskDialog>}
    {typeof dialog === 'object' && 'group' in dialog && !choosingScope && <TaskForm
      initial={dialog.occurrence ? { ...dialog.value, repeat: defaultRepeat } : dialog.value}
      title="Task details" editing occurrence={!!dialog.occurrence} busy={actions.busy} close={close}
      save={value => void actions.save(value, preferences?.weekStart ?? 0, dialog.group.task.id, dialog.occurrence, close)} />}
    {typeof dialog === 'object' && 'kind' in dialog && budget && <BudgetQuickEditor selection={dialog} data={budget.data} today={selected} close={close} />}
  </>
}
