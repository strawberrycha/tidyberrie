import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, Copy, Folder, FolderPlus, Pencil, Plus, Trash2, Unlink } from 'lucide-react'
import { inlineIconSize } from '../../app/uiTokens'
import { EmptyIllustration } from '../../shared/ui/EmptyState'
import { useToast } from '../../shared/ui/Toast'
import { ActionSheet, LongPressHint } from './ActionSheet'
import { ColorSelect, ColorSwatch } from './ColorSelect'
import { IconCarousel } from './IconPicker'
import { TaskDialog } from './TaskDialog'
import { TaskIcon } from './icons'
import { saveCategory } from './categoryService'
import { deleteCategory, deleteCategoryAndTasks, deleteGroup, duplicateCategory, moveCategoryToGroup, saveGroup, ungroup } from './hierarchyService'
import type { Category, CategoryGroup } from './useHierarchy'
import type { TaskGroup } from './model'
import { isOpen } from './model'
import { summarizeTasks } from '../calendar/taskWindow'
import { useSuggestedIcon } from './suggestIcon'
import { useTaskGesture } from './useTaskGesture'

type Panel = { kind: 'category-actions' | 'move' | 'delete' | 'delete-all' | 'edit-category'; category: Category }
  | { kind: 'group-actions' | 'edit-group'; group: CategoryGroup }
  | { kind: 'new-group'; category: Category } | { kind: 'add' | 'new-category' }
type Props = { categories: Category[]; groups: CategoryGroup[]; tasks: TaskGroup[]; today: string; query: string; categoryFilter: string;
  openCategory: (id: string) => void; addTask: () => void }

function HoldTarget({ children, label, actions }: { children: ReactNode; label: string; actions: () => void }) {
  const { consumeClick, drag, ...gesture } = useTaskGesture({ disabled: false, select: actions })
  return <div {...gesture} data-dragging={drag !== 0} onClickCapture={event => {
    if (consumeClick()) { event.preventDefault(); event.stopPropagation() }
  }} onContextMenu={event => { event.preventDefault(); actions() }}>
    {children}<button type="button" className="organizer-access-action secondary" onClick={actions}>Actions for {label}</button>
  </div>
}

export function CategoryDirectory({ categories, groups, tasks, today, query, categoryFilter, openCategory, addTask }: Props) {
  const [panel, setPanel] = useState<Panel>()
  const [busy, setBusy] = useState(false)
  const [collapsed, setCollapsed] = useState<string[]>(() => (localStorage.getItem('tidyberrie-collapsed-groups') ?? '').split(',').filter(Boolean))
  useEffect(() => { localStorage.setItem('tidyberrie-collapsed-groups', collapsed.join(',')) }, [collapsed])
  const [highlight, setHighlight] = useState('')
  const toast = useToast()
  const close = () => setPanel(undefined)
  const active = categories.filter(row => !row.archived)
  const filter = categoryFilter ? categoryFilter.split(',') : []
  const displayed = active.filter(row => highlight === row.name || ((!filter.length || filter.includes(row.id)) && row.name.toLowerCase().includes(query.trim().toLowerCase())))
  const uncategorized = tasks.filter(row => !active.some(item => item.id === row.task.categoryId))
  const activeGroups = new Set(groups.map(group => group.id))
  const done = summarizeTasks(tasks, { from: today, through: today }).get(today)?.rows.filter(row => row.value.status === 'done') ?? []
  const count = (id: string) => tasks.filter(row => row.task.categoryId === id).length

  async function perform(action: () => Promise<() => Promise<void>>, message: string) {
    setBusy(true)
    try { const undo = await action(); close(); toast({ message, action: { label: 'Undo', run: undo } }) }
    catch (failure) { toast({ message: failure instanceof Error ? failure.message : 'Could not update the item.' }) }
    finally { setBusy(false) }
  }

  function card(category?: Category) {
    const id = category?.id ?? 'none'
    const name = category?.name ?? 'Uncategorized'
    const rows = category ? tasks.filter(row => row.task.categoryId === category.id) : uncategorized
    const completed = done.filter(row => rows.some(item => item.task.id === row.group.task.id)).length
    const row = <button type="button" className={'task-card organizer-category task-color-' + (category?.color ?? 'rose')}
      onClick={() => openCategory(id)} ref={element => { if (element && highlight === name) element.scrollIntoView?.({ block: 'nearest' }) }} data-new={highlight === name || undefined}>
      <TaskIcon name={category?.icon ?? 'check'} size={inlineIconSize} />
      <strong>{name}</strong><span>{rows.filter(item => isOpen(item.task.status)).length} open{completed ? ' · ' + completed + ' done today' : ''}</span>
      {highlight === name && <span>New category</span>}
    </button>
    return category ? <HoldTarget key={id} label={name} actions={() => setPanel({ kind: 'category-actions', category })}>{row}</HoldTarget> : row
  }

  return <div className="task-grid">
    <LongPressHint available={!!(active.length || tasks.length)} />
    {!active.length && !tasks.length && <section className="empty-card">
      <EmptyIllustration icon={Folder} sticker="check" />
      <h2>Organize your tasks</h2>
      <button className="primary" onClick={() => setPanel({ kind: 'new-category' })}>Add a category</button>
      <button className="secondary" onClick={addTask}>Add a task</button>
    </section>}
    {groups.map(group => {
      const children = displayed.filter(category => category.groupId === group.id)
      const expanded = !collapsed.includes(group.id)
      return <section className="task-grid" key={group.id}>
        <HoldTarget label={group.name} actions={() => setPanel({ kind: 'group-actions', group })}>
          <button className="secondary organizer-category" type="button" aria-expanded={expanded} onClick={() => setCollapsed(previous =>
            expanded ? [...previous, group.id] : previous.filter(id => id !== group.id))}>
            <ColorSwatch color={group.color} /> {group.name} · {active.filter(category => category.groupId === group.id).length} categories
            <ChevronDown size={inlineIconSize} aria-hidden />
          </button>
        </HoldTarget>
        {expanded && children.map(card)}
      </section>
    })}
    {displayed.filter(row => !row.groupId || !activeGroups.has(row.groupId)).map(card)}
    {!!uncategorized.length && (!filter.length || filter.includes('none')) && 'uncategorized'.includes(query.trim().toLowerCase()) && card()}
    <button type="button" className="primary task-fab" aria-label="Add" onClick={() => setPanel({ kind: 'add' })}><Plus size={inlineIconSize} aria-hidden /></button>
    {panel?.kind === 'add' && <ActionSheet title="Add" close={close} actions={[
      { label: 'Add a category', icon: FolderPlus, run: () => setPanel({ kind: 'new-category' }) },
      { label: 'Add a task', icon: Plus, run: () => { close(); addTask() } },
    ]} />}
    {panel?.kind === 'category-actions' && (() => {
      const { category } = panel
      return <ActionSheet title={category.name} close={close} actions={[
        { label: 'Edit', icon: Pencil, run: () => setPanel({ kind: 'edit-category', category }) },
        { label: 'Duplicate', icon: Copy, disabled: busy, run: () => void perform(() => duplicateCategory(category.id), 'Category duplicated.') },
        { label: 'Move to a group', icon: Folder, run: () => setPanel({ kind: 'move', category }) },
        ...(category.groupId ? [{ label: 'Remove from group', icon: Unlink, run: () => void perform(() => moveCategoryToGroup(category.id, null), 'Category ungrouped.') }] : []),
        { label: 'Delete', icon: Trash2, run: () => setPanel({ kind: 'delete', category }) },
        { label: 'Delete all', icon: Trash2, run: () => setPanel({ kind: 'delete-all', category }) },
      ]} />
    })()}
    {panel?.kind === 'group-actions' && (() => {
      const { group } = panel
      return <ActionSheet title={group.name} close={close} actions={[
        { label: 'Edit group', icon: Pencil, run: () => setPanel({ kind: 'edit-group', group }) },
        { label: 'Ungroup', icon: Unlink, run: () => void perform(() => ungroup(group.id), 'Categories ungrouped.') },
        { label: 'Delete group', icon: Trash2, run: () => void perform(() => deleteGroup(group.id), 'Group deleted.') },
      ]} />
    })()}
    {panel?.kind === 'move' && (() => {
      const { category } = panel
      return <TaskDialog title="Move to a group?" close={close}><div className="task-form">
        {groups.map(group => <button type="button" className="secondary" key={group.id} disabled={busy}
          onClick={() => void perform(() => moveCategoryToGroup(category.id, group.id), 'Category moved.')}>
          <ColorSwatch color={group.color} /> {group.name}</button>)}
        <button type="button" className="secondary" onClick={() => setPanel({ kind: 'new-group', category })}>Create a group</button>
      </div></TaskDialog>
    })()}
    {(panel?.kind === 'delete' || panel?.kind === 'delete-all') && (() => {
      const { category } = panel
      const all = panel.kind === 'delete-all'
      const total = count(category.id)
      const label = total === 1 ? '1 task' : total + ' tasks'
      return <TaskDialog title={all ? 'Delete category and tasks?' : 'Delete category?'} close={close}>
        <div className="task-form"><p>{category.name} will be removed. {label} {all ? 'will also be deleted.' : 'will move to Uncategorized.'}</p>
          <div className="task-actions"><button className="secondary" onClick={close}>Back</button>
            <button className="primary" disabled={busy} onClick={() => void perform(() => all ? deleteCategoryAndTasks(category.id) : deleteCategory(category.id), 'Category deleted.')}>
              {all ? 'Delete all' : 'Delete'}</button></div>
        </div>
      </TaskDialog>
    })()}
    {(panel?.kind === 'new-category' || panel?.kind === 'edit-category' || panel?.kind === 'new-group' || panel?.kind === 'edit-group') &&
      <HierarchyForm category={panel.kind === 'edit-category' ? panel.category : undefined}
        group={panel.kind === 'edit-group' ? panel.group : undefined}
        forGroup={panel.kind === 'edit-group' || panel.kind === 'new-group'} close={close}
        save={async draft => {
          const undo = panel.kind === 'edit-group' || panel.kind === 'new-group'
            ? await saveGroup({ name: draft.name, color: draft.color }, panel.kind === 'edit-group' ? panel.group.id : undefined,
              panel.kind === 'new-group' ? panel.category.id : undefined)
            : await saveCategory(draft, panel.kind === 'edit-category' ? panel.category.id : undefined)
          if (panel.kind === 'new-category') {
            setHighlight(draft.name.trim())
            window.setTimeout(() => setHighlight(''), 2400)
          }
          close()
          toast({ message: 'Saved.', action: { label: 'Undo', run: undo } })
        }} />}
  </div>
}

function HierarchyForm({ category, group, forGroup, save, close }: {
  category?: Category; group?: CategoryGroup; forGroup: boolean; close: () => void
  save: (draft: Pick<Category, 'name' | 'color' | 'icon'>) => Promise<void>
}) {
  const initial = category ?? group
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? 'rose')
  const [icon, setIcon] = useSuggestedIcon(name, category?.icon)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function back() {
    if (busy) return
    if (name === (initial?.name ?? '') && color === (initial?.color ?? 'rose') && (!category || category.icon === icon) ||
      window.confirm('Discard unsaved changes?')) close()
  }
  return <TaskDialog full title={forGroup ? group ? 'Edit group' : 'Create a group' : category ? 'Edit category' : 'Add category'} close={back}>
    <form className="task-form" noValidate onSubmit={event => {
      event.preventDefault()
      if (busy) return
      setBusy(true)
      setError('')
      void save({ name, color, icon }).catch(failure => {
        setError(failure instanceof Error && 'issues' in failure ?
          (failure.issues as { message: string }[])[0].message : failure instanceof Error ? failure.message : 'Could not save this item.')
      }).finally(() => setBusy(false))
    }}>
      <label>{forGroup ? 'Group name' : 'Name'}<input data-first-field required value={name} onChange={event => setName(event.target.value)} /></label>
      <ColorSelect value={color} change={setColor} />
      {!forGroup && <IconCarousel value={icon} change={setIcon} />}
      {error && <p role="alert">{error}</p>}
      <footer className="task-actions task-form-footer"><button type="button" className="secondary" onClick={back}>Back</button>
        <button className="primary" disabled={busy}>Save</button></footer>
    </form>
  </TaskDialog>
}
