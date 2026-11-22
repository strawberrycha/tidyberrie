import { createContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { ReminderState } from './service'
import { reminderPlatform, requestNotifications, startReminders } from './service'
import { TaskDialog } from '../tasks/TaskDialog'

const initial: ReminderState = { due: [], limit: 64, status: { notifications: 'unknown', exact: 'unknown' } }
export const reminderView = createContext(initial)

export function ReminderProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState(initial)
  const [explain, setExplain] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => startReminders(setView), [])
  useEffect(() => {
    const show = (event: Event) => {
      if (reminderPlatform === 'android' && ((event as CustomEvent<boolean>).detail || view.status?.canPrompt)) setExplain(true)
    }
    window.addEventListener('tidyberrie-reminder-explain', show)
    return () => window.removeEventListener('tidyberrie-reminder-explain', show)
  }, [view.status?.canPrompt])

  return <reminderView.Provider value={view}>{children}
    {explain && <TaskDialog title="Tidyberrie needs permission to remind you" close={() => { if (!requesting) setExplain(false) }}>
      <p>Allow notifications so Android can show your task reminders.</p>
      {failed && <p role="alert">Could not request notifications. Try again or open Android settings from Reminders and Alarms.</p>}
      <div className="task-actions">
        <button className="secondary" disabled={requesting} onClick={() => setExplain(false)}>Not now</button>
        <button className="primary" disabled={requesting} onClick={async () => {
          setRequesting(true)
          setFailed(false)
          try { await requestNotifications(); setExplain(false) }
          catch { setFailed(true) }
          finally {
            setRequesting(false)
            window.dispatchEvent(new Event('tidyberrie-reminder-refresh'))
          }
        }}>Continue</button>
      </div>
    </TaskDialog>}
  </reminderView.Provider>
}
