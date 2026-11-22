import type { LucideIcon } from 'lucide-react'
import { Plus } from 'lucide-react'
import { useToast } from './Toast'
import type { StickerKey } from '../../assets/stickers/keys'
import { Sticker } from './Sticker'

export function EmptyIllustration({ icon: Icon, sticker }: { icon: LucideIcon; sticker: StickerKey }) {
  return <div className="sticker-slot" aria-hidden="true">
    <Sticker name={sticker} size={64} alt="" fallback={<Icon size={64} strokeWidth={1.5} aria-hidden />} />
  </div>
}

export function EmptyState({ title, description, action, icon, sticker }: {
  title: string; description: string; action: string; icon: LucideIcon; sticker: StickerKey
}) {
  const show = useToast()

  return <section className="empty-card">
    <EmptyIllustration icon={icon} sticker={sticker} />
    <h2>{title}</h2>
    <p>{description}</p>
    <button className="primary" type="button" onClick={() => show({ message: 'This action is coming in a later phase.' })}>
      <Plus size={20} aria-hidden="true" />{action}
    </button>
  </section>
}
