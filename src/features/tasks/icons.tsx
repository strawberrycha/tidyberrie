import { BookOpen, Briefcase, Check, Heart, House, Leaf, Sparkles, Star, Plane, Wallet, Brush, Moon, Target, NotebookPen, PartyPopper, ListChecks, Cross, Focus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TaskInput } from './input'
import { Sticker } from '../../shared/ui/Sticker'

const registry: Record<TaskInput['icon'], { label: string; Icon: LucideIcon }> = {
  check: { label: 'Check', Icon: Check },
  book: { label: 'Book', Icon: BookOpen },
  briefcase: { label: 'Work', Icon: Briefcase },
  heart: { label: 'Heart', Icon: Heart },
  home: { label: 'Home', Icon: House },
  leaf: { label: 'Leaf', Icon: Leaf },
  star: { label: 'Star', Icon: Star },
  sparkles: { label: 'Sparkles', Icon: Sparkles },
  study: { label: 'Study', Icon: BookOpen },
  work: { label: 'Work desk', Icon: Briefcase },
  'deep-work': { label: 'Deep work', Icon: Focus },
  rest: { label: 'Rest', Icon: Moon },
  'self-care': { label: 'Self-care', Icon: Heart },
  health: { label: 'Health', Icon: Cross },
  errands: { label: 'Errands', Icon: ListChecks },
  travel: { label: 'Travel', Icon: Plane },
  celebration: { label: 'Celebration', Icon: PartyPopper },
  journal: { label: 'Journal', Icon: NotebookPen },
  goals: { label: 'Goals', Icon: Target },
  cleaning: { label: 'Cleaning', Icon: Brush },
  'budget-day': { label: 'Budget day', Icon: Wallet },
}

export function TaskIcon({ name, size = 22, label = '' }: { name: TaskInput['icon']; size?: number; label?: string }) {
  const Icon = registry[name].Icon
  const vector = <Icon size={size} strokeWidth={1.75} aria-hidden />
  return size >= 48 ? <Sticker name={name} size={size} alt={label} fallback={vector} /> : vector
}

export const iconLabel = (key: TaskInput['icon']) => registry[key].label
