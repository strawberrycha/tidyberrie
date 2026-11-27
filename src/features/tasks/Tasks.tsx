import { features } from '../../app/features'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarArrowDown, ChevronDown, Check, Folder, ListTodo, Plus, SkipForward, Trash2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTheme } from '../../shared/theme/ThemeProvider'
import { EmptyIllustration } from '../../shared/ui/EmptyState'
import { emptyTask, newSubtask } from './input'
import type { TaskInput } from './input'
import { actionDate, overdueCount as countOverdue, smartRows } from './lists'
import type { SmartList } from './lists'
import { compareScheduleTasks, taskValue } from './model'
import type { TaskGroup, TaskRow } from './model'
import { addDays, defaultRepeat, localDate } from './recurrence'
import { SchedulePicker } from './SchedulePicker'
import { dayLabel, useSchedules } from './useSchedules'
import { createExampleSchedule, restoreSchedule } from './scheduleService'
import { summarizeTasks } from '../calendar/taskWindow'
import { useToast } from '../../shared/ui/Toast'
import { TaskCard } from './TaskCard'
import { TaskDialog } from './TaskDialog'
import { TaskForm } from './TaskForm'
import { useTaskActions, useTaskGroups } from './useTasks'
import { emptyFilters, TaskControls, useTaskSearch } from './TaskControls'
import type { BulkChange, TaskTarget } from './service'
import { inlineIconSize } from '../../app/uiTokens'
import { showDevelopmentTools } from '../../app/development'
import './tasks.css'

const PAGE_SIZE = 20
const emptyMessages: Record<SmartList, string> = {
  Today: 'Nothing due today',
  Upcoming: 'Nothing coming up',
  Overdue: 'No overdue tasks. Nice!',
  Pinned: 'Pin a task to keep it close at hand.',
  Completed: 'Nothing completed yet',
  All: 'No tasks yet',
}
type Editor = { id?: string; date?: string; initial: TaskInput }
type Dialog = { kind: 'edit'; editor: Editor } | { kind: 'edit-scope' | 'delete-scope'; row: TaskRow } | { kind: 'permanent'; group: TaskGroup } | { kind: 'actions'; row: TaskRow } | { kind: 'bulk-date' | 'bulk-schedule' | 'bulk-delete' | 'move-all'; targets: TaskTarget[] }

const rowKey = (row: TaskRow) => row.group.task.id + '/' + (row.occurrence ?? '')

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const update = () => setNow(new Date())
    const interval = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(interval); window.removeEventListener('focus', update) }
  }, [])
  return now
}

export function Tasks({ trash = false }: { trash?: boolean } = {}) {
  const [params] = useSearchParams()
  const requested = params.get('list')
  const initial = requested === 'Overdue' || requested === 'Upcoming' ? requested : 'Today'
  return <TaskView key={trash ? 'trash' : initial} trash={trash} initial={initial} />
}

function TaskView({ trash, initial }: { trash: boolean; initial: SmartList }) {
  const state = useTaskGroups(trash)
  const { preferences } = useTheme()
  const actions = useTaskActions()
  const now = useClock()
  const today = localDate(now)
  const [selectedDate, setSelectedDate] = useState('')
  const viewedDate = selectedDate || today
  const [list, setList] = useState<SmartList>(initial)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const [grouped, setGrouped] = useState(() => localStorage.getItem('tidyberrie-task-view') !== 'time')
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [overduePage, setOverduePage] = useState(0)
  const [dialog, setDialog] = useState<Dialog>()
  const [moveDate, setMoveDate] = useState('')
  const [selected, setSelected] = useState<string[]>()
  const [showOptional, setShowOptional] = useState(false)
  const view = useRef<HTMLDivElement>(null)
  const selecting = selected !== undefined && !trash
  const { groups } = state ?? {}
  const { rows: schedules } = useSchedules()
  const { rows: deletedSchedules } = useSchedules(true)
  const toast = useToast()
  const close = () => setDialog(undefined)
  const weekStart = preferences?.weekStart ?? 0

  const delayedQuery = useTaskSearch(query)
  const overdueCount = useMemo(() => !trash && groups ? countOverdue(groups, now) : 0, [groups, now, trash])
  const updateQuery = useCallback((input: string) => { setQuery(input); setPage(0) }, [])
  const add = () => setDialog({ kind: 'edit', editor: { initial: emptyTask(today) } })
  const candidates = useMemo(() => !trash && list === 'Today' && groups
    ? summarizeTasks(groups, { from: viewedDate, through: viewedDate }, true).get(viewedDate)?.rows ?? []
    : smartRows(trash ? [] : groups ?? [], list, now, overduePage), [groups, list, now, overduePage, viewedDate, trash])
  const rows = useMemo(() => {
    const search = delayedQuery.trim().toLocaleLowerCase()
    const tag = filters.tag.trim().toLocaleLowerCase()
    return candidates.filter(({ value }) => value.title.toLocaleLowerCase().includes(search)
      && (!filters.schedule || filters.schedule.split(',').includes(value.scheduleId ?? 'none')) && (!tag || value.tag.toLocaleLowerCase().includes(tag))
      && (!filters.pinned || value.pinned) && (!filters.priority || value.priority === filters.priority) && (!filters.status || value.status === filters.status))
      .sort((a, b) => {
        const dateOrder = a.value.startDate.localeCompare(b.value.startDate)
        return (list === 'Today' ? 0 : list === 'Completed' ? -dateOrder : dateOrder) ||
          (a.value.startTime || '24:00').localeCompare(b.value.startTime || '24:00') ||
          (a.value.scheduleId && a.value.scheduleId === b.value.scheduleId ? compareScheduleTasks(a.group.task, b.group.task) :
            a.group.task.createdAt.localeCompare(b.group.task.createdAt))
      })
  }, [candidates, filters, list, delayedQuery])
  const selectedKeys = useMemo(() => new Set(selected), [selected])
  const selectedRows = selected ? rows.filter(row => selectedKeys.has(rowKey(row))) : []
  const visibleRows = list === 'Overdue' ? rows.filter(row => !row.value.optional || showOptional) : rows
  const optionalRows = list === 'Overdue' ? rows.filter(row => row.value.optional) : []
  const mandatoryOverdue = list === 'Overdue' ? rows.filter(row => !row.value.optional) : []
  const clearSelection = useCallback(() => setSelected(undefined), [])
  useEffect(() => {
    const leave = () => clearSelection()
    const back = (event: Event) => { if (selecting) { event.preventDefault(); clearSelection() } }
    window.addEventListener('tidyberrie-task-tab-leave', leave)
    document.addEventListener('tidyberrie-back', back)
    return () => {
      window.removeEventListener('tidyberrie-task-tab-leave', leave)
      document.removeEventListener('tidyberrie-back', back)
    }
  }, [clearSelection, selecting])

  const trashed = useMemo(() => trash ? [...groups ?? []].filter(group => !group.schedule?.deletedAt).sort((a, b) => b.task.deletedAt!.localeCompare(a.task.deletedAt!)) : [], [groups, trash])
  const size = trash ? trashed.length : Math.max(visibleRows.length, optionalRows.length ? 1 : 0)
  const lastPage = Math.max(0, Math.ceil(size / PAGE_SIZE) - 1)
  const currentPage = Math.min(page, lastPage)
  const start = currentPage * PAGE_SIZE

  const scheduleGroups = [...schedules.map(item => ({ key: item.id, name: item.name, days: item.days })), { key: '', name: 'Other tasks', days: [] }]

  function toggle(row: TaskRow) {
    const key = rowKey(row)
    setSelected(previous => previous?.includes(key) ? previous.filter(id => id !== key) : [...previous ?? [], key])
    if (!selecting) requestAnimationFrame(() => view.current?.querySelector<HTMLElement>('[aria-label="Exit selection"]')?.focus())
  }
  const targetsFor = (items: TaskRow[]) => items.map(row => ({ id: row.group.task.id, occurrence: actionDate(row, now) }))
  const openDate = (items: TaskRow[]) => { setMoveDate(today); setDialog({ kind: 'bulk-date', targets: targetsFor(items) }) }
  const applyBulk = (targets: TaskTarget[], change: BulkChange) => void actions.bulk(targets, change, () => {
    close()
    clearSelection()
  })
  const selectedTargets = targetsFor(selectedRows)
  const unavailable = selectedRows.some((row, index) => (row.group.task.repeatRule || row.group.task.scheduleId) && !selectedTargets[index].occurrence)
  const repeatingIds = new Set((groups ?? []).filter(group => group.task.repeatRule || group.task.scheduleId).map(group => group.task.id))
  const openDelete = () => setDialog({ kind: 'bulk-delete', targets: selectedTargets })

  function edit(row: TaskRow, date?: string) {
    const value = taskValue(row.group, today, date)
    setDialog({ kind: 'edit', editor: { id: row.group.task.id, date, initial: date ? { ...value, repeat: defaultRepeat } : value } })
  }

  function remove(row: TaskRow, date?: string) {
    void actions.remove(row.group.task.id, date, close)
  }

  function save(editor: Editor, value: TaskInput) {
    void actions.save(value, weekStart, editor.id, editor.date, () => {
      if (!editor.id) { setList('All'); setPage(0); setQuery(''); setFilters(emptyFilters) }
      close()
    })
  }

  return <div ref={view} className="tasks-view" data-task-selection={selecting || undefined}>
    {!trash && <TaskControls list={list} select={item => { setList(item); if (item === 'Today') setSelectedDate(''); setPage(0); setOverduePage(0) }}
      query={query} setQuery={updateQuery} filters={filters} apply={next => { setFilters(next); setPage(0) }}
      overdue={overdueCount} schedules={schedules} grouped={grouped} setGrouped={value => { setGrouped(value); localStorage.setItem('tidyberrie-task-view', value ? 'schedule' : 'time'); setPage(0) }}
      selection={selecting ? { count: selectedRows.length, clear: clearSelection, all: () => setSelected(visibleRows.map(rowKey)) } : undefined} />}
    <div className="tasks-toolbar">
      {!trash && !selecting && list === 'Today' && <label>View date<input type="date" value={viewedDate}
        onChange={event => { setSelectedDate(event.target.value); setPage(0) }} /></label>}
      {trash && <Link className="secondary" to="/tasks">Back to tasks</Link>}
      {import.meta.env.DEV && showDevelopmentTools(true) && !trash && !selecting && <button className="secondary" type="button" disabled={actions.busy} onClick={() => {
        void actions.seed(weekStart, () => { setList('All'); setPage(0) })
      }}>Development: seed 1,000 tasks</button>}
    </div>
    {!trash && !selecting && <>
      {list === 'Overdue' && <div className="task-actions overdue-window">
        {!!mandatoryOverdue.length && <button type="button" className="secondary" onClick={() => setDialog({ kind: 'move-all', targets: targetsFor(mandatoryOverdue) })}>Move all to today</button>}
        <button type="button" className="secondary" onClick={() => { setOverduePage(overduePage + 1); setPage(0) }}>Older repeats</button>
        <span>Repeats {addDays(today, -29 - overduePage * 30)} to {addDays(today, -overduePage * 30)}</span>
        {!!overduePage && <button type="button" className="secondary" onClick={() => { setOverduePage(overduePage - 1); setPage(0) }}>Newer repeats</button>}
      </div>}
    </>}
    {features.schedules && trash && deletedSchedules.map(schedule => <section className="task-card" key={schedule.id}>
      <h2>{schedule.name}</h2>
      <button className="secondary" onClick={() => void restoreSchedule(schedule.id).then(undo =>
        toast({ message: 'Schedule and tasks restored.', action: { label: 'Undo', run: undo } }),
      () => toast({ message: 'Could not restore the schedule.' }))}>Restore schedule</button>
    </section>)}
    {state?.error ? <p role="alert">Tasks could not be loaded.</p> : !groups ? <div className="task-loading" role="status" aria-label="Loading tasks" /> : size === 0
      ? <section className="empty-card task-empty"><EmptyIllustration sticker="check" icon={ListTodo} />
        {features.schedules && !trash && groups.length === 0 && schedules.length === 0 && list === 'Today' && !selectedDate ? <>
          <h2>Plan your day with a schedule</h2>
          <Link className="primary" to="/more/schedules?new=1">Create a schedule</Link>
          <button className="secondary" onClick={() => void createExampleSchedule().then(undo =>
            toast({ message: 'Example schedule created.', action: { label: 'Undo', run: undo } }),
          () => toast({ message: 'Could not create the example schedule.' }))}>Try an example schedule</button>
        </> : <><h2>{trash ? features.schedules && deletedSchedules.length ? 'Deleted schedules' : 'Trash is empty' : query || Object.values(filters).some(Boolean) ? 'No matching tasks' : emptyMessages[list]}</h2>
        {trash ? <p>Deleted tasks stay here for 30 days.</p> : !query && !Object.values(filters).some(Boolean) &&
          (list === 'Today' || list === 'Upcoming' || list === 'All') && <button type="button" className="primary" onClick={add}>Add a task</button>}</>}
      </section>
      : <>
        <div className="task-grid" role={selecting ? 'grid' : undefined} aria-label={selecting ? 'Select tasks' : undefined} aria-multiselectable={selecting || undefined}>
          {trash ? trashed.slice(start, start + PAGE_SIZE).map(group => <article className="task-card" key={group.task.id}>
            <h3>{group.task.title}</h3>
            <p>Deleted {group.task.deletedAt?.slice(0, 10)}</p>
            <ul>{group.subtasks.filter(item => item.deletedAt === group.task.deletedAt).sort((a, b) => a.order - b.order)
              .map(item => <li key={item.id}>{item.title}</li>)}</ul>
            <div className="task-actions">
              <button type="button" className="secondary" disabled={actions.busy} onClick={() => void actions.restore(group.task.id)}>Restore</button>
              <button type="button" className="secondary" disabled={actions.busy} onClick={() => setDialog({ kind: 'permanent', group })}>Delete permanently</button>
            </div>
          </article>) : (() => {
            const renderRow = (row: TaskRow) => {
            const repeating = !!(row.group.task.repeatRule || row.group.task.scheduleId)
            const date = actionDate(row, now)
            const displayed = date && !row.occurrence ? { ...row, occurrence: date, value: taskValue(row.group, today, date) } : row
            return <TaskCard key={row.group.task.id + (row.occurrence ?? '')} row={displayed} schedule={schedules.find(item => item.id === row.value.scheduleId) ?? row.group.schedule} timeFormat={preferences?.timeFormat} next={list === 'Today' && viewedDate === today && rows.find(item => item.value.status !== 'done' && item.value.status !== 'skipped') === row} now={now} disabled={actions.busy} canComplete={!repeating || !!date}
              addSubtask={title => void actions.save({ ...displayed.value, subtasks: [...displayed.value.subtasks, { ...newSubtask(), title }] }, weekStart, row.group.task.id, date, () => {})}
              check={(done, id) => void actions.check(row.group.task.id, date, done, id)}
              menu={() => setDialog({ kind: 'actions', row })}
              selection={selecting ? selectedKeys.has(rowKey(row)) : undefined} select={() => toggle(row)}
              swipe={!repeating || date ? action => action === 'done'
                ? void actions.check(row.group.task.id, date, displayed.value.status !== 'done')
                : openDate([row]) : undefined}
              move={list === 'Overdue' ? days => applyBulk(targetsFor([row]), { kind: 'date', date: addDays(today, days) }) : undefined}
              edit={() => repeating ? setDialog({ kind: 'edit-scope', row }) : edit(row)}
              remove={() => repeating ? setDialog({ kind: 'delete-scope', row }) : remove(row)} />
            }
            function renderDates(pageRows: TaskRow[]) {
              return [...new Set(pageRows.map(row => row.value.startDate))].map(date => <section className="task-grid" key={date}>
                <h2><time dateTime={date}>{date}</time></h2>{pageRows.filter(row => row.value.startDate === date).map(renderRow)}
              </section>)
            }
            if (list === 'Overdue') {
              const current = [...mandatoryOverdue, ...(showOptional ? optionalRows : [])].slice(start, start + PAGE_SIZE)
              return <>
                {selecting ? current.filter(row => !row.value.optional).map(renderRow) : renderDates(current.filter(row => !row.value.optional))}
                {!!optionalRows.length && <div role={selecting ? 'row' : undefined}>
                  <div role={selecting ? 'gridcell' : undefined}>
                    <button type="button" className="secondary" aria-expanded={showOptional} onClick={() => setShowOptional(!showOptional)}>
                      Optional · {optionalRows.length}
                    </button>
                  </div>
                </div>}
                {selecting ? current.filter(row => row.value.optional).map(renderRow) : renderDates(current.filter(row => row.value.optional))}
              </>
            }
            if (selecting || (list === 'Today' && (!grouped || !features.schedules))) return visibleRows.slice(start, start + PAGE_SIZE).map(renderRow)
            if (list !== 'Today') return renderDates(visibleRows.slice(start, start + PAGE_SIZE))
            return scheduleGroups.map(group => {
              const groupRows = visibleRows.filter(row => (row.value.scheduleId ?? '') === group.key)
              if (!groupRows.length) return null
              const hidden = collapsed.includes(group.key)
              const counted = groupRows.filter(row => row.value.status !== 'skipped')
              return <section className="task-grid" key={group.key}>
                <div className="task-actions"><button className="secondary" aria-expanded={!hidden} onClick={() => setCollapsed(previous =>
                  hidden ? previous.filter(key => key !== group.key) : [...previous, group.key])}>
                  <ChevronDown size={inlineIconSize} aria-hidden />{group.name} {group.days.length > 0 && '· ' + dayLabel(group.days)} · {counted.filter(row => row.value.status === 'done').length} of {counted.length} done
                </button>{group.key && <button className="icon-button" aria-label={'Add task to ' + group.name} onClick={() => setDialog({ kind: 'edit',
                  editor: { initial: { ...emptyTask(today), scheduleId: group.key, allDay: false, alertNotify: true, reminders: [0] } } })}>
                  <Plus size={inlineIconSize} aria-hidden /></button>}</div>
                {!hidden && groupRows.map(renderRow)}
              </section>
            })
          })()}
        </div>
        {(!features.schedules || !grouped || list !== 'Today' || selecting) && visibleRows.length > 0 && <p role="status" className="task-result-count">{start + 1}–{Math.min(start + PAGE_SIZE, size)} of {size}</p>}
        {(!features.schedules || !grouped || list !== 'Today' || selecting) && lastPage > 0 && <div className="task-actions">
          <button type="button" className="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous page</button>
          <button type="button" className="secondary" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next page</button>
        </div>}
      </>}
    {!trash && !selecting && <button type="button" className="primary task-fab" aria-label="Add task" onClick={add}><Plus size={26} aria-hidden /></button>}
    {dialog?.kind === 'edit' && <TaskForm key={dialog.editor.id ?? 'new'} initial={dialog.editor.initial} title={dialog.editor.id ? 'Edit task' : 'Add task'} occurrence={!!dialog.editor.date} editing={!!dialog.editor.id}
      busy={actions.busy} close={close} save={value => save(dialog.editor, value)}
      duplicate={dialog.editor.id ? () => void actions.duplicate(dialog.editor.id!, weekStart, (id, value) =>
        setDialog({ kind: 'edit', editor: { id, initial: value } })) : undefined} />}
    {(dialog?.kind === 'edit-scope' || dialog?.kind === 'delete-scope') && (() => {
      const editing = dialog.kind === 'edit-scope'
      const row = dialog.row
      const date = actionDate(row, now)
      const choose = (date?: string) => editing ? edit(row, date) : remove(row, date)
      return <TaskDialog title={row.group.task.scheduleId ? editing ? 'Edit scheduled task' : 'Delete scheduled task' : editing ? 'Edit repeating task' : 'Delete repeating task'} close={close}>
        <div className="task-form">
          <p>{row.value.title}{date ? ' · ' + date : ''}</p>
          {date && <button type="button" className="secondary" disabled={actions.busy} onClick={() => choose(date)}>{row.group.task.scheduleId ? 'This day only' : 'This occurrence only'}</button>}
          <button type="button" className={row.group.task.scheduleId && editing ? 'primary' : 'secondary'} disabled={actions.busy} onClick={() => choose()}>{row.group.task.scheduleId ? editing ? 'All days of this schedule' : 'Whole task' : 'All occurrences'}</button>
          <button type="button" className="secondary" onClick={close}>Cancel</button>
        </div>
      </TaskDialog>
    })()}
    {dialog?.kind === 'actions' && (() => {
      const { row } = dialog
      const id = row.group.task.id
      const date = actionDate(row, now)
      const canChange = (!row.group.task.repeatRule && !row.group.task.scheduleId) || !!date
      return <TaskDialog title={row.value.title} close={close}><div className="task-form">
        <button className="secondary" disabled={!canChange} onClick={() => { void actions.check(id, date, row.value.status !== 'done'); close() }}>
          {row.value.status === 'done' ? 'Back to To do' : 'Mark done'}
        </button>
        <button className="secondary" disabled={!canChange} onClick={() => { void actions.status(id, date, 'in_progress'); close() }}>In progress</button>
        <button className="secondary" disabled={!canChange} onClick={() => { void actions.status(id, date, 'skipped'); close() }}>Skip</button>
        <button className="secondary" disabled={!canChange} onClick={() => openDate([row])}>Reschedule</button>
        {features.schedules && <button className="secondary" onClick={() => setDialog({ kind: 'bulk-schedule', targets: targetsFor([row]) })}>Move to another schedule</button>}
        <button className="secondary" onClick={() => { toggle(row); close() }}>Select</button>
        <button className="secondary" onClick={() => (row.group.task.repeatRule || row.group.task.scheduleId) ? setDialog({ kind: 'delete-scope', row }) : remove(row)}>Delete</button>
        <button className="secondary" onClick={() => void actions.duplicate(id, weekStart, (copyId, value) =>
          setDialog({ kind: 'edit', editor: { id: copyId, initial: value } }))}>Duplicate</button>
      </div></TaskDialog>
    })()}
    {selecting && <div className="task-selection-bar" role="group" aria-label="Selected task actions">
      {([
        ['Done', Check, () => applyBulk(selectedTargets, { kind: 'done' }), unavailable],
        ['Skip', SkipForward, () => applyBulk(selectedTargets, { kind: 'skip' }), unavailable],
        ['Schedule', Folder, () => setDialog({ kind: 'bulk-schedule', targets: selectedTargets }), false],
        ['Date', CalendarArrowDown, () => openDate(selectedRows), unavailable],
        ['Delete', Trash2, openDelete, false],
      ] as const).filter(([label]) => features.schedules || label !== 'Schedule').map(([label, Icon, run, disabled]) => <button className="secondary" key={label} disabled={actions.busy || !selectedRows.length || disabled} onClick={run}>
        <Icon aria-hidden size={inlineIconSize} /> {label}</button>)}
      {unavailable && <p>Choose a dated occurrence to change its status or date.</p>}
    </div>}
    {dialog?.kind === 'bulk-schedule' && <SchedulePicker rows={schedules} current={null} close={close}
      choose={scheduleId => applyBulk(dialog.targets, { kind: 'schedule', scheduleId })} />}
    {dialog?.kind === 'bulk-date' && <TaskDialog title={dialog.targets.length === 1 ? 'Reschedule task' : 'Reschedule tasks'} close={close}>
      <form className="task-form" onSubmit={event => {
        event.preventDefault()
        applyBulk(dialog.targets, { kind: 'date', date: moveDate })
      }}>
        <div className="task-date-chips">{(['Today', 'Tomorrow', 'Next week'] as const).map((label, index) => {
          const date = addDays(today, [0, 1, 7][index])
          return <button className="secondary" type="button" key={label} aria-pressed={moveDate === date} onClick={() => setMoveDate(date)}><span>{label}</span></button>
        })}</div>
        <label>Pick date<input type="date" required min={today} value={moveDate} onChange={event => setMoveDate(event.target.value)} /></label>
        <button className="primary" disabled={!moveDate || moveDate < today || actions.busy}>Move {dialog.targets.length === 1 ? 'task' : 'tasks'}</button>
      </form>
    </TaskDialog>}
    {dialog?.kind === 'move-all' && <TaskDialog title="Move overdue tasks to today?" close={close}>
      <div className="task-form"><p>{dialog.targets.length} tasks will move to today.</p>
        <button className="primary" disabled={actions.busy} onClick={() => applyBulk(dialog.targets, { kind: 'date', date: today })}>Move to today</button>
      </div>
    </TaskDialog>}
    {dialog?.kind === 'bulk-delete' && <TaskDialog title="Delete selected tasks?" close={close}>
      <div className="task-form"><p>{dialog.targets.length} selected. You can undo this change.</p>
        {dialog.targets.some(target => repeatingIds.has(target.id)) ? <>
          <button className="secondary" disabled={actions.busy || dialog.targets.some(target => repeatingIds.has(target.id) && !target.occurrence)}
            onClick={() => applyBulk(dialog.targets, { kind: 'delete', scope: 'occurrence' })}>This occurrence only</button>
          <button className="secondary" disabled={actions.busy} onClick={() => applyBulk(dialog.targets, { kind: 'delete', scope: 'series' })}>Whole series</button>
        </> : <button className="primary" disabled={actions.busy} onClick={() => applyBulk(dialog.targets, { kind: 'delete', scope: 'series' })}>Delete selected</button>}
      </div>
    </TaskDialog>}
    {dialog?.kind === 'permanent' && <TaskDialog title="Delete task permanently?" close={close}>
      <div className="task-form"><p>“{dialog.group.task.title}” and its subtasks will be permanently deleted.</p>
        <div className="task-actions">
          <button type="button" className="secondary" data-first-field onClick={close}>Cancel</button>
          <button type="button" className="primary" disabled={actions.busy} onClick={() => void actions.erase(dialog.group.task.id, close)}>Delete permanently</button>
        </div>
      </div>
    </TaskDialog>}
  </div>
}
