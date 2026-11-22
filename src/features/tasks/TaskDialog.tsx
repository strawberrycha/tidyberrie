import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function TaskDialog({ title, close, children, side = false }: {
  title: string; close: () => void; children: ReactNode; side?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    const firstField = dialog.querySelector<HTMLElement>('[data-first-field]')
    firstField?.focus()
    return () => dialog.close()
  }, [])

  return <dialog ref={ref} className={side ? 'task-dialog calendar-side' : 'task-dialog'} aria-label={title} onCancel={event => {
    event.preventDefault()
    close()
  }} onKeyDown={event => {
    if (event.key !== 'Tab') return
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary',
    )].filter(element => !element.closest('[hidden]'))
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus() }
    if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus() }
  }}>
    <header><h2>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={close}><X size={20} aria-hidden /></button></header>
    {children}
  </dialog>
}
