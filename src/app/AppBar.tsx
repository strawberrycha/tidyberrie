import { iconStroke } from './uiTokens'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

export function AppBar({ title, back, children, actions }: {
  title: string; back?: () => void; children?: ReactNode; actions?: ReactNode
}) {
  return <header className="app-bar">
    {back && <button className="icon-button" type="button" aria-label="Back" onClick={back}><ArrowLeft aria-hidden strokeWidth={iconStroke} /></button>}
    {children ?? <h1>{title}</h1>}
    {actions && <div className="app-bar-actions">{actions}</div>}
  </header>
}
