import { features } from '../../app/features'
import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Ellipsis, Search, SlidersHorizontal, X } from 'lucide-react'
import { AppBar } from '../../app/AppBar'
import { iconStroke, inlineIconSize, searchDelay } from '../../app/uiTokens'
import { priorities, statuses, statusLabels } from './input'
import type { SmartList } from './lists'
import type { Records } from '../../shared/db/schemas'
import { TaskDialog } from './TaskDialog'

export const emptyFilters = { schedule: '', tag: '', priority: '', status: '', pinned: false }
export type Filters = typeof emptyFilters
const chips = ['Today', 'Upcoming', 'Overdue', 'All', 'Completed'] as const
const filterLabels = { schedule: 'Schedule', tag: 'Tag', priority: 'Priority', status: 'Status', pinned: 'Pinned only' }

export function useTaskSearch(query: string) {
  const [delayed, setDelayed] = useState(query)
  useEffect(() => {
    const timer = setTimeout(() => setDelayed(query), searchDelay)
    return () => clearTimeout(timer)
  }, [query])
  return query ? delayed : ''
}

export function TaskControls({ list, select, query, setQuery, filters, apply, overdue, schedules = [], grouped, setGrouped, selection }: {
  list: SmartList; select: (list: SmartList) => void; query: string; setQuery: (query: string) => void;
  filters: Filters; apply: (next: Filters) => void; overdue: number
  schedules?: Records['schedules'][]; grouped?: boolean; setGrouped?: (value: boolean) => void
  selection?: { count: number; clear: () => void; all: () => void }
}) {
  const [searching, search] = useState(false)
  const [sheet, setSheet] = useState<'filter' | 'sort'>()
  const field = useRef<HTMLInputElement>(null)
  const searchButton = useRef<HTMLButtonElement>(null)
  const active = (Object.keys(filters) as (keyof Filters)[]).filter(key => Boolean(filters[key]))
  const close = () => setSheet(undefined)

  function closeSearch() {
    setQuery('')
    search(false)
    requestAnimationFrame(() => searchButton.current?.focus())
  }

  useEffect(() => {
    if (!searching) return
    field.current?.focus()
    function back(event: Event) {
      if (field.current?.closest('[hidden]')) return
      event.preventDefault()
      setQuery('')
      search(false)
      requestAnimationFrame(() => searchButton.current?.focus())
    }
    document.addEventListener('tidyberrie-back', back)
    return () => document.removeEventListener('tidyberrie-back', back)
  }, [searching, setQuery])

  if (selection) return <div className="task-controls">
    <AppBar title={selection.count + ' selected'} actions={<>
      <button type="button" className="secondary" onClick={selection.all}>Select all</button>
      <button type="button" className="icon-button" aria-label="Exit selection" onClick={selection.clear}><X aria-hidden /></button>
    </>} />
    <span className="sr-only" role="status" aria-live="polite">{selection.count} selected</span>
  </div>

  return <>
    <div className="task-controls">
      {searching ? <AppBar title="Tasks" back={closeSearch} actions={
        <button className="icon-button" type="button" aria-label="Clear search" onClick={() => { setQuery(''); field.current?.focus() }}><X aria-hidden strokeWidth={iconStroke} /></button>
      }>
        <input className="task-search-input" ref={field} type="search" aria-label="Search tasks" value={query}
          placeholder="Search tasks" onChange={event => setQuery(event.target.value)} onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); closeSearch() }
          }} />
      </AppBar> : <AppBar title="Tasks" actions={<>
        <button ref={searchButton} type="button" className="icon-button" aria-label="Search" onClick={() => search(true)}><Search aria-hidden strokeWidth={iconStroke} /></button>
        <button type="button" className="icon-button task-filter-button" aria-label={active.length ? 'Filter, ' + active.length + ' active' : 'Filter'} onClick={() => setSheet('filter')}>
          <SlidersHorizontal aria-hidden strokeWidth={iconStroke} />{active.length > 0 && <span className="control-badge" aria-hidden>{active.length}</span>}
        </button>
        {features.schedules && <button type="button" className="icon-button" aria-label="More task options" onClick={() => setSheet('sort')}><Ellipsis aria-hidden strokeWidth={iconStroke} /></button>}
      </>} />}
      <div className="task-chip-edge">
        <nav className="task-list-chips" aria-label="Task lists">
          {chips.map(item => <button key={item} type="button" aria-pressed={item === list} onClick={() => select(item)}>
            <span>{item === 'Completed' ? 'Done' : item}
              {item === 'Overdue' && overdue > 0 && <span className="chip-count">{overdue}</span>}
            </span>
          </button>)}
        </nav>
      </div>
    </div>
    {active.length > 0 && <div className="active-filters" aria-label="Active filters">
      {active.map(key => {
        const label = key === 'pinned' ? filterLabels[key] : filterLabels[key] + ': ' +
          (key === 'schedule' ? filters.schedule.split(',').map(id => schedules.find(item => item.id === id)?.name ?? 'Other tasks').join(', ') : key === 'status'
            ? statusLabels[filters.status as keyof typeof statusLabels] : key === 'priority' ? filters.priority[0].toUpperCase() + filters.priority.slice(1) : filters.tag)
        return <button type="button" className="secondary" aria-label={'Remove ' + label} key={key}
          onClick={() => apply({ ...filters, [key]: emptyFilters[key] })}>{label}<X aria-hidden size={inlineIconSize} strokeWidth={iconStroke} /></button>
      })}
    </div>}
    {sheet === 'filter' && <FilterSheet schedules={schedules} initial={filters} close={close} apply={next => { apply(next); close() }} />}
    {features.schedules && sheet === 'sort' && <TaskDialog title="Task options" close={close}>
      <label className="task-sheet-field">View<select value={grouped ? 'schedule' : 'time'}
        onChange={event => { setGrouped?.(event.target.value === 'schedule'); close() }}>
        <option value="schedule">By schedule</option><option value="time">By time</option>
      </select></label>
      <Link className="secondary" to="/more/schedules">Manage schedules</Link>
    </TaskDialog>}
  </>
}

function FilterSheet({ initial, close, apply, schedules }: { schedules: Records['schedules'][]; initial: Filters; close: () => void; apply: (next: Filters) => void }) {
  const [draft, setDraft] = useState(initial)
  return <TaskDialog title="Filter tasks" close={close}>
    <div className="sheet-handle" aria-hidden />
    <form className="task-form task-filter-sheet" onSubmit={event => { event.preventDefault(); apply(draft) }}>
      {features.schedules && <fieldset><legend>Schedules</legend>
        {[{ id: 'none', name: 'Other tasks' }, ...schedules].map(item => {
          const selected = draft.schedule ? draft.schedule.split(',') : []
          return <label className="task-check" key={item.id}><input type="checkbox" checked={selected.includes(item.id)}
            onChange={event => setDraft({ ...draft, schedule: (event.target.checked ? [...selected, item.id] :
              selected.filter(id => id !== item.id)).join(',') })} />{item.name}</label>
        })}
      </fieldset>}
      <label>Tag<input value={draft.tag} onChange={event => setDraft({ ...draft, tag: event.target.value })} /></label>
      <label>Priority<select value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value })}><option value="">Any priority</option>{priorities.map(priority => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></label>
      <label>Status<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}><option value="">Any status</option>{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
      <label className="task-check"><input type="checkbox" checked={draft.pinned} onChange={event => setDraft({ ...draft, pinned: event.target.checked })} />Pinned only</label>
      <div className="task-actions"><button type="button" className="secondary" onClick={() => setDraft(emptyFilters)}>Reset</button><button type="submit" className="primary">Show results</button></div>
    </form>
  </TaskDialog>
}
