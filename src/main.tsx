import { lazy, StrictMode, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { CalendarDays, House, ListTodo, Settings2, Wallet } from 'lucide-react'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-700.css'
import '@fontsource/nunito/latin-800.css'
import '@fontsource/caveat/latin-700.css'
import './shared/theme/styles.css'
import './shared/ui/stickers.css'
import { ThemeProvider, useTheme } from './shared/theme/ThemeProvider'
import { ToastProvider, useToast } from './shared/ui/Toast'
import { ScreenBoundary } from './shared/ui/ScreenBoundary'
import { useTaskMaintenance } from './features/tasks/useTaskMaintenance'
import { saveDailySnapshot } from './shared/db/backupService'
import { BackupNudge } from './features/settings/BackupNudge'
import { AppLock } from './features/settings/AppLock'
import { features } from './app/features'
import { EmptyIllustration } from './shared/ui/EmptyState'
import { ReminderProvider } from './features/reminders/ReminderProvider'

const Tasks = lazy(() => import('./features/tasks/Tasks').then(module => ({ default: module.Tasks })))
const loadHome = () => import('./features/dayTheme/Home').then(module => ({ default: module.Home }))
const Home = lazy(loadHome)
if (features.home && window.location.pathname === '/') void loadHome().catch(() => {})
const Calendar = lazy(() => import('./features/calendar/Calendar').then(module => ({ default: module.Calendar })))
const Settings = lazy(() => import('./features/settings/Settings').then(module => ({ default: module.Settings })))
const Budget = lazy(() => import('./features/budget/Budget').then(module => ({ default: module.Budget })))
const BudgetExtras = lazy(() => import('./features/budget/BudgetExtras').then(module => ({ default: module.BudgetExtras })))
const MonthlySummary = lazy(() => import('./features/budget/MonthlySummary').then(module => ({ default: module.MonthlySummary })))
const Reminders = lazy(() => import('./features/reminders/Reminders').then(module => ({ default: module.Reminders })))


const screens = [
  { path: '/', title: 'Home', icon: House, Page: Home, enabled: features.home, sticker: 'check' as const },
  { path: '/calendar', title: 'Calendar', icon: CalendarDays, Page: Calendar, enabled: features.calendar, sticker: 'journal' as const },
  { path: '/tasks', title: 'Tasks', icon: ListTodo, Page: Tasks, enabled: features.tasks, sticker: 'check' as const },
  { path: '/budget', title: 'Budget', icon: Wallet, Page: Budget, enabled: features.budget, sticker: 'avatar-wallet' as const },
  { path: '/settings', title: 'Settings', icon: Settings2, Page: Settings, enabled: true, sticker: 'check' as const },
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

function ScreenContent({ children }: { children: React.ReactNode }) {
  const { pathname, search } = useLocation()
  const placeholder = screens.some(({ path, enabled }) => !enabled &&
    (pathname === path || (path !== '/' && pathname.startsWith(path + '/'))))
  return <>
    {!placeholder && <BackupNudge />}
    <ScreenBoundary key={pathname + search}>{children}</ScreenBoundary>
  </>
}

function App() {
  return <ThemeProvider><BrowserRouter><AppLock><ToastProvider><ReminderProvider>
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
        <ScreenContent><Routes>
          {screens.map(({ path, title, Page, enabled, icon, sticker }) => <Route key={path} path={path} element={<>
            <h1>{title}</h1>{enabled ? <Suspense fallback={<p role="status">Loading…</p>}><Page /></Suspense> :
              <section className="empty-card"><EmptyIllustration icon={icon} sticker={sticker} />
                <p>{title} is coming soon.</p></section>}
          </>} />)}
          <Route path="/settings/reminders" element={<><h1>Reminders</h1>
            <Suspense fallback={<p role="status">Loading…</p>}><Reminders /></Suspense>
          </>} />
          <Route path="/budget/extras" element={!features.budget ? <Navigate to="/budget" replace /> : <><h1>Budget extras</h1><Suspense fallback={<p role="status">Loading…</p>}><BudgetExtras /></Suspense></>} />
          <Route path="/budget/summary" element={!features.budget ? <Navigate to="/budget" replace /> : <><h1>Monthly summary</h1><Suspense fallback={<p role="status">Loading…</p>}><MonthlySummary /></Suspense></>} />
          {!features.budget && <Route path="/budget/*" element={<Navigate to="/budget" replace />} />}
          {!features.calendar && <Route path="/calendar/*" element={<Navigate to="/calendar" replace />} />}
          <Route path="*" element={<><h1>Page unavailable</h1><NavLink to="/">Go to Home</NavLink></>} />
        </Routes></ScreenContent>
      </main>
    </div>
  </ReminderProvider></ToastProvider></AppLock></BrowserRouter></ThemeProvider>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
