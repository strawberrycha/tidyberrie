import { useCallback, useEffect, useMemo, useState } from 'react'
import { ListTodo, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTheme } from '../../shared/theme/ThemeProvider'
import { EmptyIllustration } from '../../shared/ui/EmptyState'
import { emptyTask, priorities } from './input'
import type { TaskInput } from './input'
import { actionDate, smartRows } from './lists'
import type { SmartList } from './lists'
import { taskValue } from './model'
import type { TaskGroup, TaskRow } from './model'
import { addDays, defaultRepeat, localDate } from './recurrence'
import { TaskCard } from './TaskCard'
import { TaskDialog } from './TaskDialog'
import { TaskForm } from './TaskForm'
import { useTaskActions, useTaskGroups } from './useTasks'
import { emptyFilters, TaskControls, useTaskSearch } from './TaskControls'
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
  const [list, setList] = useState<SmartList>(initial)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const [sort, setSort] = useState('date')
  const [page, setPage] = useState(0)
  const [overduePage, setOverduePage] = useState(0)
  const [dialog, setDialog] = useState<Dialog>()
  const { groups } = state ?? {}
  const close = () => setDialog(undefined)
  const weekStart = preferences?.weekStart ?? 0

  const delayedQuery = useTaskSearch(query)
  const overdueCount = useMemo(() => !trash && groups ? smartRows(groups, 'Overdue', now).length : 0, [groups, now, trash])
  const updateQuery = useCallback((input: string) => { setQuery(input); setPage(0) }, [])
  const add = () => setDialog({ kind: 'edit', editor: { initial: emptyTask(today) } })
  const candidates = useMemo(() => smartRows(trash ? [] : groups ?? [], list, now, overduePage), [groups, list, now, overduePage, trash])
  const rows = useMemo(() => {
    const search = delayedQuery.trim().toLocaleLowerCase()
    const tag = filters.tag.trim().toLocaleLowerCase()
    return candidates.filter(({ value }) => value.title.toLocaleLowerCase().includes(search)
      && (!filters.color || value.color === filters.color) && (!tag || value.tag.toLocaleLowerCase().includes(tag))
      && (!filters.pinned || value.pinned) && (!filters.priority || value.priority === filters.priority) && (!filters.status || value.status === filters.status))
      .sort((a, b) => {
        const dateOrder = a.value.startDate.localeCompare(b.value.startDate) || a.value.startTime.localeCompare(b.value.startTime)
        if (sort === 'priority') return priorities.indexOf(b.value.priority) - priorities.indexOf(a.value.priority) || dateOrder
        if (sort === 'created') return b.group.task.createdAt.localeCompare(a.group.task.createdAt) || dateOrder
        return list === 'Completed' ? -dateOrder : dateOrder
      })
  }, [candidates, filters, list, delayedQuery, sort])
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

  function save(editor: Editor, value: TaskInput) {
    void actions.save(value, weekStart, editor.id, editor.date, () => {
      if (!editor.id) { setList('All'); setPage(0); setQuery(''); setFilters(emptyFilters) }
      close()
    })
  }

  return <div className="tasks-view">
    {!trash && <TaskControls list={list} select={item => { setList(item); setPage(0); setOverduePage(0) }}
      query={query} setQuery={updateQuery} filters={filters} apply={next => { setFilters(next); setPage(0) }}
      sort={sort} setSort={next => { setSort(next); setPage(0) }} overdue={overdueCount} />}
    <div className="tasks-toolbar">
      {trash && <Link className="secondary" to="/tasks">Back to tasks</Link>}
      {import.meta.env.DEV && showDevelopmentTools(true) && !trash && <button className="secondary" type="button" disabled={actions.busy} onClick={() => {
        void actions.seed(weekStart, () => { setList('All'); setPage(0) })
      }}>Development: seed 1,000 tasks</button>}
    </div>
    {!trash && <>
      {list === 'Overdue' && <div className="task-actions overdue-window">
        <button type="button" className="secondary" onClick={() => { setOverduePage(overduePage + 1); setPage(0) }}>Older repeats</button>
        <span>Repeats {addDays(today, -29 - overduePage * 30)} to {addDays(today, -overduePage * 30)}</span>
        {!!overduePage && <button type="button" className="secondary" onClick={() => { setOverduePage(overduePage - 1); setPage(0) }}>Newer repeats</button>}
      </div>}
    </>}
    {state?.error ? <p role="alert">Tasks could not be loaded.</p> : !groups ? <div className="task-loading" role="status" aria-label="Loading tasks" /> : size === 0
      ? <section className="empty-card task-empty"><EmptyIllustration sticker="check" icon={ListTodo} />
        <h2>{trash ? 'Trash is empty' : query || Object.values(filters).some(Boolean) ? 'No matching tasks' : emptyMessages[list]}</h2>
        {trash ? <p>Deleted tasks stay here for 30 days.</p> : !query && !Object.values(filters).some(Boolean) &&
          (list === 'Today' || list === 'Upcoming' || list === 'All') && <button type="button" className="primary" onClick={add}>Add a task</button>}
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
    {!trash && <button type="button" className="primary task-fab" aria-label="Add task" onClick={add}><Plus size={26} aria-hidden /></button>}
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
