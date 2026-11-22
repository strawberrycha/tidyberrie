import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

type Toast = { message: string; action?: { label: string; run: () => Promise<void> } }
const ToastContext = createContext<(toast: Toast) => void>(() => {})

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast>()
  const show = useCallback((next: Toast) => setToast(next), [])

  async function run() {
    if (!toast?.action) return
    const action = toast.action
    setToast({ message: 'Restoring…' })
    try {
      await action.run()
      setToast({ message: 'Restored.' })
    } catch {
      setToast({ message: 'Could not restore the item.' })
    }
  }

  return <ToastContext.Provider value={show}>
    {children}
    <div className="toast-region">
      <div role="status">{toast?.message}</div>
      {toast && <>
        {toast.action && <button type="button" className="secondary" onClick={() => void run()}>{toast.action.label}</button>}
        <button type="button" className="icon-button" aria-label="Dismiss message" onClick={() => setToast(undefined)}><X size={20} /></button>
      </>}
    </div>
  </ToastContext.Provider>
}
