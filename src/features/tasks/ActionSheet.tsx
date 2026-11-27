import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { inlineIconSize } from '../../app/uiTokens'
import { TaskDialog } from './TaskDialog'

export type SheetAction = { label: string; icon: LucideIcon; run: () => void; disabled?: boolean }
export function ActionSheet({ title, close, actions }: { title: string; close: () => void; actions: SheetAction[] }) {
  return <TaskDialog title={title} close={close}>
    <div className="task-form">{actions.map(({ label, icon: Icon, run, disabled }) =>
      <button type="button" className="secondary" key={label} disabled={disabled} onClick={run}>
        <Icon size={inlineIconSize} aria-hidden /> {label}
      </button>)}</div>
  </TaskDialog>
}

export function LongPressHint({ available }: { available: boolean }) {
  const [dismissed, dismiss] = useState(() => localStorage.getItem('tidyberrie-hold-tip') === 'seen')
  return available && !dismissed ? <div className="task-actions">
    <p>Tip: press and hold to see more actions</p>
    <button type="button" className="secondary" onClick={() => { localStorage.setItem('tidyberrie-hold-tip', 'seen'); dismiss(true) }}>Got it</button>
  </div> : null
}
