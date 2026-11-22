import { Sparkles, Sun } from 'lucide-react'
import { EmptyState } from '../../shared/ui/EmptyState'

export function Home() {
  return <>
    <div className="day-badge"><Sun size={18} aria-hidden="true" /> Day Theme</div>
    <EmptyState title="A fresh start" description="Your plans for the day will find a home here." action="Quick add" icon={Sparkles} />
  </>
}
