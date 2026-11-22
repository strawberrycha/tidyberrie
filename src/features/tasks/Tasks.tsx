import { useEffect, useMemo, useState } from 'react'
import { Archive, ListTodo, Plus, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTheme } from '../../shared/theme/ThemeProvider'
import { colorLabels, colors, emptyTask, priorities, statusLabels, statuses } from './input'
import type { TaskInput } from './input'
import { actionDate, smartLists, smartRows } from './lists'
import type { SmartList } from './lists'
import { taskValue } from './model'
import type { TaskGroup, TaskRow } from './model'
import { addDays, defaultRepeat, localDate } from './recurrence'
import { TaskCard } from './TaskCard'
import { TaskDialog } from './TaskDialog'
import { TaskForm } from './TaskForm'
import { useTaskActions, useTaskGroups } from './useTasks'
import './tasks.css'

const PAGE_SIZE = 20
const emptyMessages: Record<SmartList, string> = {
  Today: 'You have no open tasks for today.',
  Upcoming: 'You have no open tasks for the next seven days.',
  Overdue: 'There are no overdue tasks in this view.',
  Pinned: 'Pin a task to keep it close at hand.',
  Completed: 'Completed tasks will appear here.',
  All: 'Add a task to get started.',
}
type Editor = { id?: string; date?: string; initial: TaskInput }
type Dialog = { kind: 'edit'; editor: Editor } | { kind: 'edit-scope' | 'delete-scope'; row: TaskRow } | { kind: 'permanent'; group: TaskGroup }

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

export function Tasks() {
  const [params] = useSearchParams()
  return <TaskView key={params.has('trash') ? 'trash' : 'tasks'} trash={params.has('trash')} />
}

function TaskView({ trash }: { trash: boolean }) {
  const state = useTaskGroups(trash)
  const { preferences } = useTheme()
  const actions = useTaskActions()
  const now = useClock()
  const today = localDate(now)
  const [list, setList] = useState<SmartList>('Today')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ color: '', tag: '', priority: '', status: '' })
  const [sort, setSort] = useState('date')
  const [page, setPage] = useState(0)
  const [overduePage, setOverduePage] = useState(0)
  const [dialog, setDialog] = useState<Dialog>()
  const { groups } = state ?? {}
  const close = () => setDialog(undefined)
  const weekStart = preferences?.weekStart ?? 1

  const candidates = useMemo(() => smartRows(trash ? [] : groups ?? [], list, now, overduePage), [groups, list, now, overduePage, trash])
  const rows = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    const tag = filters.tag.trim().toLocaleLowerCase()
    return candidates.filter(({ value }) => value.title.toLocaleLowerCase().includes(search)
      && (!filters.color || value.color === filters.color) && (!tag || value.tag.toLocaleLowerCase().includes(tag))
      && (!filters.priority || value.priority === filters.priority) && (!filters.status || value.status === filters.status))
      .sort((a, b) => {
        const dateOrder = a.value.startDate.localeCompare(b.value.startDate) || a.value.startTime.localeCompare(b.value.startTime)
        if (sort === 'priority') return priorities.indexOf(b.value.priority) - priorities.indexOf(a.value.priority) || dateOrder
        if (sort === 'created') return b.group.task.createdAt.localeCompare(a.group.task.createdAt) || dateOrder
        return list === 'Completed' ? -dateOrder : dateOrder
      })
  }, [candidates, filters, list, query, sort])
  const trashed = useMemo(() => trash ? [...groups ?? []].sort((a, b) => b.task.deletedAt!.localeCompare(a.task.deletedAt!)) : [], [groups, trash])
  const size = trash ? trashed.length : rows.length
  const lastPage = Math.max(0, Math.ceil(size / PAGE_SIZE) - 1)
  const currentPage = Math.min(page, lastPage)
  const start = currentPage * PAGE_SIZE

  function edit(row: TaskRow, date?: string) {
    const value = taskValue(row.group, today, date)
    setDialog({ kind: 'edit', editor: { id: row.group.task.id, date, initial: date ? { ...value, repeat: defaultRepeat } : value } })
  }

  function remove(row: TaskRow, date?: string) {
    void actions.remove(row.group.task.id, date, close)
  }

  function changeFilter(key: keyof typeof filters, value: string) {
    setFilters(previous => ({ ...previous, [key]: value }))
    setPage(0)
  }

  function save(editor: Editor, value: TaskInput) {
    void actions.save(value, weekStart, editor.id, editor.date, () => {
      if (!editor.id) { setList('All'); setPage(0); setQuery(''); setFilters({ color: '', tag: '', priority: '', status: '' }) }
      close()
    })
  }

  return <div className="tasks-view">
    <div className="tasks-toolbar">
      {trash ? <Link className="secondary" to="/tasks">Back to tasks</Link> : <Link className="secondary" to="/tasks?trash"><Archive size={18} aria-hidden /> Trash</Link>}
      {import.meta.env.DEV && !trash && <button className="secondary" type="button" disabled={actions.busy} onClick={() => {
        void actions.seed(weekStart, () => { setList('All'); setPage(0) })
      }}>Development: seed 1,000 tasks</button>}
    </div>
    {trash ? <h2>Trash</h2> : <>
      <nav className="smart-lists" aria-label="Task lists">
        {smartLists.map(item => <button type="button" key={item} aria-pressed={item === list} onClick={() => { setList(item); setPage(0); setOverduePage(0) }}>{item}</button>)}
      </nav>
      <div className="task-search">
        <label><Search size={18} aria-hidden /> Search tasks<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} /></label>
        <details><summary>Filters and sorting</summary>
          <div className="task-fields">
            <label>Color<select value={filters.color} onChange={event => changeFilter('color', event.target.value)}><option value="">Any color</option>{colors.map((color, index) => <option key={color} value={color}>{colorLabels[index]}</option>)}</select></label>
            <label>Tag<input value={filters.tag} onChange={event => changeFilter('tag', event.target.value)} /></label>
            <label>Priority<select value={filters.priority} onChange={event => changeFilter('priority', event.target.value)}><option value="">Any priority</option>{priorities.map(priority => <option key={priority}>{priority}</option>)}</select></label>
            <label>Status<select value={filters.status} onChange={event => changeFilter('status', event.target.value)}><option value="">Any status</option>{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
            <label>Sort by<select value={sort} onChange={event => { setSort(event.target.value); setPage(0) }}><option value="date">Date</option><option value="priority">Priority</option><option value="created">Newest created</option></select></label>
          </div>
        </details>
      </div>
      {list === 'Overdue' && <div className="task-actions overdue-window">
        <button type="button" className="secondary" onClick={() => { setOverduePage(overduePage + 1); setPage(0) }}>Older repeats</button>
        <span>Repeats {addDays(today, -29 - overduePage * 30)} to {addDays(today, -overduePage * 30)}</span>
        {!!overduePage && <button type="button" className="secondary" onClick={() => { setOverduePage(overduePage - 1); setPage(0) }}>Newer repeats</button>}
      </div>}
    </>}
    {state?.error ? <p role="alert">Tasks could not be loaded.</p> : !groups ? <p role="status">Loading tasks…</p> : size === 0
      ? <section className="empty-card"><div className="sticker-slot" aria-hidden="true"><ListTodo size={48} /></div>
        <h2>{trash ? 'Trash is empty' : 'No tasks to show'}</h2>
        <p>{trash ? 'Deleted tasks stay here for 30 days.' : query || Object.values(filters).some(Boolean) ? 'Try a different search or filter.' : emptyMessages[list]}</p>
      </section>
      : <>
        <div className="task-grid">
          {trash ? trashed.slice(start, start + PAGE_SIZE).map(group => <article className="task-card" key={group.task.id}>
            <h3>{group.task.title}</h3>
            <p>Deleted {group.task.deletedAt?.slice(0, 10)}</p>
            <ul>{group.subtasks.filter(item => item.deletedAt === group.task.deletedAt).sort((a, b) => a.order - b.order)
              .map(item => <li key={item.id}>{item.title}</li>)}</ul>
            <div className="task-actions">
              <button type="button" className="secondary" disabled={actions.busy} onClick={() => void actions.restore(group.task.id)}>Restore</button>
              <button type="button" className="secondary" disabled={actions.busy} onClick={() => setDialog({ kind: 'permanent', group })}>Delete permanently</button>
            </div>
          </article>) : rows.slice(start, start + PAGE_SIZE).map(row => {
            const repeating = !!row.group.task.repeatRule
            const date = actionDate(row, now)
            const displayed = date && !row.occurrence ? { ...row, occurrence: date, value: taskValue(row.group, today, date) } : row
            return <TaskCard key={row.group.task.id + (row.occurrence ?? '')} row={displayed} now={now} disabled={actions.busy} canComplete={!repeating || !!date}
              check={(done, id) => void actions.check(row.group.task.id, date, done, id)}
              edit={() => repeating ? setDialog({ kind: 'edit-scope', row }) : edit(row)}
              remove={() => repeating ? setDialog({ kind: 'delete-scope', row }) : remove(row)} />
          })}
        </div>
        <p role="status" className="task-result-count">{start + 1}–{Math.min(start + PAGE_SIZE, size)} of {size}</p>
        {lastPage > 0 && <div className="task-actions">
          <button type="button" className="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous page</button>
          <button type="button" className="secondary" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next page</button>
        </div>}
      </>}
    {!trash && <button type="button" className="primary task-fab" aria-label="Add task" onClick={() => setDialog({ kind: 'edit', editor: { initial: emptyTask(today) } })}><Plus size={26} aria-hidden /></button>}
    {dialog?.kind === 'edit' && <TaskForm initial={dialog.editor.initial} title={dialog.editor.id ? 'Edit task' : 'Add task'} occurrence={!!dialog.editor.date}
      busy={actions.busy} close={close} save={value => save(dialog.editor, value)} />}
    {(dialog?.kind === 'edit-scope' || dialog?.kind === 'delete-scope') && (() => {
      const editing = dialog.kind === 'edit-scope'
      const row = dialog.row
      const date = actionDate(row, now)
      const choose = (date?: string) => editing ? edit(row, date) : remove(row, date)
      return <TaskDialog title={editing ? 'Edit repeating task' : 'Delete repeating task'} close={close}>
        <div className="task-form">
          <p>{row.value.title}{date ? ' · ' + date : ''}</p>
          {date && <button type="button" className="secondary" disabled={actions.busy} onClick={() => choose(date)}>This occurrence only</button>}
          <button type="button" className="secondary" disabled={actions.busy} onClick={() => choose()}>All occurrences</button>
          <button type="button" className="secondary" onClick={close}>Cancel</button>
        </div>
      </TaskDialog>
    })()}
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
