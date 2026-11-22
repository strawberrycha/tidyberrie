import { ListTodo } from 'lucide-react'
import { EmptyState } from '../../shared/ui/EmptyState'

export function Tasks() {
  return <EmptyState title="No tasks yet" description="Make space for the things you want to get done." action="Add a task" icon={ListTodo} />
}
