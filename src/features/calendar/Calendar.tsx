import { CalendarDays } from 'lucide-react'
import { EmptyState } from '../../shared/ui/EmptyState'

export function Calendar() {
  return <EmptyState title="Your calendar is clear" description="Dated plans will appear on your calendar." action="Add a plan" icon={CalendarDays} />
}
