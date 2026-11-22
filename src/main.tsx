import { lazy, StrictMode, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { CalendarDays, House, ListTodo, Settings2, Wallet } from 'lucide-react'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/caveat/latin-700.css'
import './shared/theme/styles.css'
import './shared/ui/stickers.css'
import { ThemeProvider, useTheme } from './shared/theme/ThemeProvider'
import { ToastProvider, useToast } from './shared/ui/Toast'
import { PwaStatus } from './shared/ui/PwaStatus'
import { useTaskMaintenance } from './features/tasks/useTaskMaintenance'
import { saveDailySnapshot } from './shared/db/backupService'
import { ReminderProvider } from './features/reminders/useReminders'

const Tasks = lazy(() => import('./features/tasks/Tasks').then(module => ({ default: module.Tasks })))
const Home = lazy(() => import('./features/dayTheme/Home').then(module => ({ default: module.Home })))
const Calendar = lazy(() => import('./features/calendar/Calendar').then(module => ({ default: module.Calendar })))
const Settings = lazy(() => import('./features/settings/Settings').then(module => ({ default: module.Settings })))
const Budget = lazy(() => import('./features/budget/Budget').then(module => ({ default: module.Budget })))
const BudgetExtras = lazy(() => import('./features/budget/BudgetExtras').then(module => ({ default: module.BudgetExtras })))
const MonthlySummary = lazy(() => import('./features/budget/MonthlySummary').then(module => ({ default: module.MonthlySummary })))
const Reminders = lazy(() => import('./features/reminders/Reminders').then(module => ({ default: module.Reminders })))

const screens = [
  { path: '/', title: 'Home', icon: House, Page: Home },
  { path: '/calendar', title: 'Calendar', icon: CalendarDays, Page: Calendar },
  { path: '/tasks', title: 'Tasks', icon: ListTodo, Page: Tasks },
  { path: '/budget', title: 'Budget', icon: Wallet, Page: Budget },
  { path: '/settings', title: 'Settings', icon: Settings2, Page: Settings },
]

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
  return <ThemeProvider><ToastProvider><ReminderProvider><BrowserRouter>
    <DailySnapshots />
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="shell">
      <header className="brand"><NavLink to="/"><img src="/icon-192.png" alt="" width="40" height="40" /> Tidyberrie</NavLink></header>
      <nav className="navigation" aria-label="Main navigation">
        {screens.map(({ path, title, icon: Icon }) => <NavLink key={path} to={path} end>
          <Icon size={22} strokeWidth={1.75} aria-hidden="true" /><span>{title}</span>
        </NavLink>)}
      </nav>
      <main id="main" tabIndex={-1}>
        <Routes>
          {screens.map(({ path, title, Page }) => <Route key={path} path={path} element={<>
            <h1>{title}</h1><Suspense fallback={<p role="status">Loading…</p>}><Page /></Suspense>
          </>} />)}
          <Route path="/settings/reminders" element={<><h1>Reminders</h1>
            <Suspense fallback={<p role="status">Loading…</p>}><Reminders /></Suspense>
          </>} />
          <Route path="/budget/extras" element={<><h1>Budget extras</h1><Suspense fallback={<p role="status">Loading…</p>}><BudgetExtras /></Suspense></>} />
          <Route path="/budget/summary" element={<><h1>Monthly summary</h1><Suspense fallback={<p role="status">Loading…</p>}><MonthlySummary /></Suspense></>} />
          <Route path="*" element={<><h1>Page unavailable</h1><NavLink to="/">Go to Home</NavLink></>} />
        </Routes>
      </main>
    </div>
    {!Capacitor.isNativePlatform() && <PwaStatus />}
  </BrowserRouter></ReminderProvider></ToastProvider></ThemeProvider>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
