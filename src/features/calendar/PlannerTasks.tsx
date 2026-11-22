import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTheme } from '../../shared/theme/ThemeProvider'
import { TaskCard } from '../tasks/TaskCard'
import { TaskForm } from '../tasks/TaskForm'
import { emptyTask } from '../tasks/input'
import type { TaskRow } from '../tasks/model'
import { useTaskActions } from '../tasks/useTasks'

export type QuickDraft = { date: string; time?: string }

export function QuickAdd({ draft, close }: { draft: QuickDraft; close: () => void }) {
  const { preferences } = useTheme()
  const actions = useTaskActions()
  const initial = { ...emptyTask(draft.date), startTime: draft.time ?? '', allDay: !draft.time }
  return <TaskForm initial={initial} title="Add task" busy={actions.busy} close={close}
    save={value => void actions.save(value, preferences?.weekStart ?? 1, undefined, undefined, close)} />
}

export function PlannerAddButton({ open }: { open: () => void }) {
  return <button type="button" className="primary task-fab" aria-label="Add task" onClick={open}><Plus size={26} aria-hidden /></button>
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
