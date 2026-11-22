import { Frown, Meh, Smile, SmilePlus } from 'lucide-react'

const moods = {
  none: { Icon: Meh, label: 'Ready to get started' },
  some: { Icon: Smile, label: 'Making progress' },
  all: { Icon: SmilePlus, label: 'Celebrating a finished day' },
  overdue: { Icon: Frown, label: 'Overdue tasks need attention' },
}

export function Avatar({ mood, image }: { mood: keyof typeof moods; image?: string }) {
  const { Icon, label } = moods[mood]
  return <div className="planner-avatar" role="img" aria-label={label}>
    {image ? <img src={image} alt="" /> : <Icon size={48} strokeWidth={1.75} aria-hidden />}
  </div>
}
