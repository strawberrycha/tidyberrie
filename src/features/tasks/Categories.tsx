import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useToast } from '../../shared/ui/Toast'
import type { Records } from '../../shared/db/schemas'
import { archiveCategory, moveCategory, saveCategory, watchCategories, watchLastCategory } from './categoryService'
import { colorLabels, colors } from './input'
import { IconPicker } from './IconPicker'
import { TaskIcon } from './icons'
import { TaskDialog } from './TaskDialog'
import { useTaskGroups } from './useTasks'
import './tasks.css'

type Category = Records['categories']
const initial = { name: '', color: 'rose', icon: 'check' } as Pick<Category, 'name' | 'color' | 'icon'>

export function useCategories() {
  const [rows, setRows] = useState<Category[]>([])
  const [error, setError] = useState(false)
  useEffect(() => watchCategories(setRows, () => setError(true)), [])
  const [lastCategory, setLastCategory] = useState<string | null>(null)
  useEffect(() => watchLastCategory(setLastCategory), [])
  return { rows, error, lastCategory }
}

export function CategoryPicker({ rows, current, choose, close }: {
  rows: Category[]; current: string | null; choose: (id: string | null) => void; close: () => void
}) {
  return <TaskDialog title="Choose a category" close={close}>
    <div className="task-form">
      <button type="button" className="secondary" aria-pressed={current === null} onClick={() => choose(null)}>None</button>
      {rows.filter(item => !item.archived).map(item => <button type="button" className={'secondary task-color-' + item.color}
        key={item.id} aria-pressed={current === item.id} onClick={() => choose(item.id)}>
        <span className="task-glyph"><TaskIcon name={item.icon} /></span> {item.name}
      </button>)}
    </div>
  </TaskDialog>
}

export function Categories() {
  const { rows, error: loadError } = useCategories()
  const tasks = useTaskGroups(false)?.groups ?? []
  const [editing, setEditing] = useState<Category | 'new'>()
  const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const notify = useToast()
  const active = rows.filter(item => !item.archived)

  function edit(item: Category | 'new') {
    setEditing(item)
    setDraft(item === 'new' ? initial : { name: item.name, color: item.color, icon: item.icon })
    setError('')
  }

  async function run(operation: () => Promise<void>, inline = false) {
    setBusy(true)
    try { await operation() }
    catch (error) {
      const detail = error instanceof Error && 'issues' in error
        ? (error.issues as { message: string }[])[0]?.message : error instanceof Error ? error.message : 'Could not save category.'
      if (inline) setError(detail)
      else notify({ message: detail })
    } finally { setBusy(false) }
  }

  return <div className="task-grid">
    <button type="button" className="primary" onClick={() => edit('new')}>Add category</button>
    {loadError && <p role="alert">Categories could not be loaded.</p>}
    {[...active, ...rows.filter(item => item.archived)].map(item => <article className={'task-card task-color-' + item.color} key={item.id}>
      <div className="task-card-heading"><span className="task-glyph"><TaskIcon name={item.icon} /></span>
        <div><h2>{item.name}</h2><p>{tasks.filter(({ task }) => task.categoryId === item.id).length} tasks{item.archived ? ' · Archived' : ''}</p></div>
      </div>
      <div className="task-actions">
        <button className="secondary" disabled={busy} onClick={() => edit(item)}>Edit</button>
        {!item.archived && ([-1, 1] as const).map(direction => {
          const Icon = direction < 0 ? ArrowUp : ArrowDown
          const label = direction < 0 ? 'Move up' : 'Move down'
          return <button className="icon-button" key={direction} aria-label={label + ' ' + item.name}
            disabled={busy || !active[active.indexOf(item) + direction]} onClick={() => void run(() => moveCategory(item.id, direction))}><Icon aria-hidden /></button>
        })}
        <button className="secondary" disabled={busy} onClick={() => void run(async () => {
          const undo = await archiveCategory(item.id, !item.archived)
          notify({ message: item.archived ? 'Category restored.' : 'Category archived.', action: { label: 'Undo', run: undo } })
        })}>{item.archived ? 'Restore' : 'Archive'}</button>
      </div>
    </article>)}
    {editing && <TaskDialog title={editing === 'new' ? 'Add category' : 'Edit category'} close={() => setEditing(undefined)}>
      <form className="task-form" noValidate onSubmit={event => {
        event.preventDefault()
        void run(async () => {
          await saveCategory(draft, editing === 'new' ? undefined : editing.id)
          setEditing(undefined)
          notify({ message: 'Category saved.' })
        }, true)
      }}>
        <label>Name<input data-first-field value={draft.name} aria-invalid={!!error} aria-describedby={error ? 'category-error' : undefined}
          onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        {error && <p id="category-error" className="task-error" role="alert">{error}</p>}
        <label>Color<select value={draft.color} onChange={event => setDraft({ ...draft, color: event.target.value as Category['color'] })}>
          {colors.map((color, index) => <option key={color} value={color}>{colorLabels[index]}</option>)}
        </select></label>
        <IconPicker value={draft.icon} change={icon => setDraft({ ...draft, icon })} />
        <button className="primary" disabled={busy}>Save category</button>
      </form>
    </TaskDialog>}
  </div>
}
