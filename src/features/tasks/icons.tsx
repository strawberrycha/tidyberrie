import { BookOpen, Briefcase, Check, Heart, House, Sparkles } from 'lucide-react'
import type { ComponentType } from 'react'
import type { TaskInput } from './input'

type IconProps = { size?: number; 'aria-hidden'?: boolean }
const registry: Record<TaskInput['icon'], { label: string; Icon: ComponentType<IconProps> }> = {
  check: { label: 'Check', Icon: Check },
  book: { label: 'Book', Icon: BookOpen },
  briefcase: { label: 'Work', Icon: Briefcase },
  heart: { label: 'Heart', Icon: Heart },
  home: { label: 'Home', Icon: House },
  leaf: { label: 'Leaf', Icon: () => <span aria-hidden="true">🌿</span> },
  star: { label: 'Star', Icon: () => <span aria-hidden="true">⭐</span> },
  sparkles: { label: 'Sparkles', Icon: Sparkles },
}

export function TaskIcon({ name, size = 22 }: { name: TaskInput['icon']; size?: number }) {
  const Icon = registry[name].Icon
  return <Icon size={size} aria-hidden />
}

export const iconLabel = (key: TaskInput['icon']) => registry[key].label
