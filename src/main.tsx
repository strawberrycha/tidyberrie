import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/caveat/latin-700.css'
import './shared/theme/styles.css'
import './shared/ui/stickers.css'
import { ThemeProvider, useTheme } from './shared/theme/ThemeProvider'
import { ToastProvider, useToast } from './shared/ui/Toast'
import { useTaskMaintenance } from './features/tasks/useTaskMaintenance'
import { saveDailySnapshot } from './shared/db/backupService'
import { AppLock } from './features/settings/AppLock'
import { ReminderProvider } from './features/reminders/ReminderProvider'

import { Shell } from './app/Shell'
import './app/shell.css'

function DailySnapshots() {
  useTaskMaintenance()
  const { preferences } = useTheme()
  const show = useToast()

  useEffect(() => {
    if (!preferences) return
    function capture() {
      void saveDailySnapshot().catch(() => show({ message: 'Could not save a local snapshot.' }))
    }
    capture()
    window.addEventListener('focus', capture)
    const timer = window.setInterval(capture, 60_000)
    return () => {
      window.removeEventListener('focus', capture)
      window.clearInterval(timer)
    }
  }, [preferences, show])

  return null
}

function App() {
  return <ThemeProvider><BrowserRouter><AppLock><ToastProvider><ReminderProvider>
    <DailySnapshots />
    <Shell />
  </ReminderProvider></ToastProvider></AppLock></BrowserRouter></ThemeProvider>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
