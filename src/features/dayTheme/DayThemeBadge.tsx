import { Sun } from 'lucide-react'
import { TaskIcon } from '../tasks/icons'
import type { ThemeChoice } from './model'

export function DayThemeBadge({ theme }: { theme?: ThemeChoice }) {
  return <span className={'planner-badge' + (theme ? ' task-color-' + theme.color : '')}>
    {theme ? <TaskIcon name={theme.icon} size={48} /> : <Sun size={48} aria-hidden />}
    {theme?.name ?? 'No Day Theme'}
  </span>
}
