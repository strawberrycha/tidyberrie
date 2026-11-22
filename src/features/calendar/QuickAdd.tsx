import { useTheme } from '../../shared/theme/ThemeProvider'
import { TaskForm } from '../tasks/TaskForm'
import { emptyTask } from '../tasks/input'
import { useTaskActions } from '../tasks/useTasks'

export type QuickDraft = { date: string; time?: string }

export function QuickAdd({ draft, close }: { draft: QuickDraft; close: () => void }) {
  const { preferences } = useTheme()
  const actions = useTaskActions()
  const initial = { ...emptyTask(draft.date), startTime: draft.time ?? '', allDay: !draft.time }
  return <TaskForm initial={initial} title="Add task" busy={actions.busy} close={close}
    save={value => void actions.save(value, preferences?.weekStart ?? 1, undefined, undefined, close)} />
}
