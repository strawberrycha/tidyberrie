import type { LucideIcon } from 'lucide-react'
import { Plus } from 'lucide-react'
import { useToast } from './Toast'

export function EmptyState({ title, description, action, icon: Icon }: {
  title: string; description: string; action: string; icon: LucideIcon
}) {
  const show = useToast()

  return <section className="empty-card">
    <div className="sticker-slot" aria-hidden="true"><Icon size={48} strokeWidth={1.5} /></div>
    <h2>{title}</h2>
    <p>{description}</p>
    <button className="primary" type="button" onClick={() => show({ message: 'This action is coming in a later phase.' })}>
      <Plus size={20} aria-hidden="true" />{action}
    </button>
  </section>
}
