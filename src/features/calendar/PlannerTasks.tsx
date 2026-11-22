import { lazy, Suspense, useState } from 'react'
import { Plus } from 'lucide-react'
import { TaskCard } from '../tasks/TaskCard'
import type { TaskRow } from '../tasks/model'
import { useTaskActions } from '../tasks/useTasks'

import type { QuickDraft } from './QuickAdd'
export type { QuickDraft } from './QuickAdd'

const QuickAddForm = lazy(() => import('./QuickAdd').then(module => ({ default: module.QuickAdd })))

export function QuickAdd(props: { draft: QuickDraft; close: () => void }) {
  return <Suspense fallback={<p role="status">Opening task editor…</p>}><QuickAddForm {...props} /></Suspense>
}

export function PlannerAddButton({ open, label = 'Add task' }: { open: () => void; label?: string }) {
  return <button type="button" className="primary task-fab" aria-label={label} onClick={open}><Plus size={26} aria-hidden /></button>
}

export function PlannerTaskList({ rows, now }: { rows: TaskRow[]; now: Date }) {
  const actions = useTaskActions()
  const [limit, setLimit] = useState(20)
  return <div className="planner-task-list">
    {rows.slice(0, limit).map(row => <TaskCard key={row.group.task.id + '/' + (row.occurrence ?? '')}
      row={row} now={now} canComplete disabled={actions.busy}
      check={(done, id) => void actions.check(row.group.task.id, row.occurrence, done, id)} />)}
    {rows.length > limit && <button type="button" className="secondary" onClick={() => setLimit(limit + 20)}>Show more tasks</button>}
  </div>
}
