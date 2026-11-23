import type { Schedule } from './useSchedules'
import { TaskDialog } from './TaskDialog'
import { TaskIcon } from './icons'

export function SchedulePicker({ rows, current, choose, close }: {
  rows: Schedule[]; current: string | null; choose: (id: string | null) => void; close: () => void
}) {
  return <TaskDialog title="Choose a schedule" close={close}>
    <div className="task-form">
      <button className="secondary" aria-pressed={current === null} onClick={() => choose(null)}>None (one-time task)</button>
      {rows.map(row => <button className={'secondary task-color-' + row.color} key={row.id} aria-pressed={current === row.id} onClick={() => choose(row.id)}>
        <span className="task-glyph"><TaskIcon name={row.icon} /></span> {row.name}
      </button>)}
    </div>
  </TaskDialog>
}
