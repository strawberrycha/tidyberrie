import { Frown, Moon, Sun, SmilePlus } from 'lucide-react'
import { avatarSize, barIconSize, iconStroke } from '../../app/uiTokens'
import { Sticker } from '../../shared/ui/Sticker'
import type { StickerKey } from '../../assets/stickers/keys'

const moods = {
  none: { Icon: Sun, label: 'Ready to get started', sticker: 'avatar-happy' },
  some: { Icon: Sun, label: 'Making progress', sticker: 'avatar-cheering' },
  all: { Icon: SmilePlus, label: 'Celebrating a finished day', sticker: 'avatar-cheering' },
  overdue: { Icon: Frown, label: 'Overdue tasks need attention', sticker: 'avatar-thinking' },
} as const

export function Avatar({ mood, evening = false }: { mood: keyof typeof moods; evening?: boolean }) {
  const { Icon, label, sticker } = moods[mood]
  const Fallback = mood === 'none' && evening ? Moon : Icon
  const pose: StickerKey = mood === 'none' && evening ? 'avatar-sleepy' : sticker
  return <div className={mood === 'all' ? 'planner-avatar avatar-celebration' : 'planner-avatar'}>
    <Sticker name={pose} size={avatarSize} alt={pose === 'avatar-sleepy' ? 'Winding down for the evening' : label}
      fallback={<Fallback size={barIconSize} strokeWidth={iconStroke} aria-hidden />} />
  </div>
}
