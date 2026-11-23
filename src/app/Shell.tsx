import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { AppBar } from './AppBar'
import { useKeyboardClearance } from './useKeyboardClearance'
import { PlannerAddButton, QuickAdd } from '../features/calendar/PlannerTasks'
import { localDate } from '../features/tasks/recurrence'
import { features } from './features'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { backAction, moreItems, moreRoute, tabFor, tabs } from './navigation'
import type { TabId } from './navigation'
import { useMinuteClock } from './useMinuteClock'
import { useTaskGroups } from '../features/tasks/useTasks'
import { overdueCount } from '../features/tasks/lists'
import { BackupNudge } from '../features/settings/BackupNudge'
import { LockSettings } from '../features/settings/AppLock'
import { EmptyIllustration } from '../shared/ui/EmptyState'
import { ScreenBoundary } from '../shared/ui/ScreenBoundary'
import { useToast } from '../shared/ui/Toast'

const Tasks = lazy(() => import('../features/tasks/Tasks').then(m => ({ default: m.Tasks })))
const Home = lazy(() => import('../features/home/Home').then(m => ({ default: m.Home })))
const Calendar = lazy(() => import('../features/calendar/Calendar').then(m => ({ default: m.Calendar })))
const Budget = lazy(() => import('../features/budget/Budget').then(m => ({ default: m.Budget })))
const BudgetExtras = lazy(() => import('../features/budget/BudgetExtras').then(m => ({ default: m.BudgetExtras })))
const MonthlySummary = lazy(() => import('../features/budget/MonthlySummary').then(m => ({ default: m.MonthlySummary })))
const Categories = lazy(() => import('../features/tasks/Categories').then(m => ({ default: m.Categories })))
const More = lazy(() => import('../features/settings/More').then(m => ({ default: m.More })))
const Appearance = lazy(() => import('../features/settings/Settings').then(m => ({ default: m.Appearance })))
const Backups = lazy(() => import('../features/settings/BackupSettings').then(m => ({ default: m.BackupSettings })))
const Reminders = lazy(() => import('../features/reminders/Reminders').then(m => ({ default: m.Reminders })))

const pages = { home: Home, tasks: Tasks, calendar: Calendar, budget: Budget, more: More }
const morePages = {
  trash: <Tasks trash />, categories: <Categories />, reminders: <Reminders />, appearance: <Appearance />, backups: <Backups />,
  security: <LockSettings />, about: <section className="settings-card"><p>Tidyberrie is your private, offline planner for Android.</p></section>,
}

const url = ({ pathname, search, hash }: Location) => pathname + search + hash
const rootFor = (id: TabId) => tabs.find(tab => tab.id === id)!.route
const rootLocation = (id: TabId): Location => ({ pathname: rootFor(id), search: '', hash: '', state: null, key: 'root' })

function TabRoutes({ location, tab, overdue }: { location: Location; tab: typeof tabs[number]; overdue: number }) {
  const Page = pages[tab.id]
  const navigate = useNavigate()
  const Icon = tab.icon
  return <ScreenBoundary key={location.pathname + location.search}>
    <Suspense fallback={<p role="status">Loading…</p>}>
      <Routes location={location}>
        <Route path={tab.route} element={tab.enabled ? <>
          {tab.id !== 'home' && tab.id !== 'tasks' && <AppBar title={tab.label} />}{tab.id === 'more' && <BackupNudge />}{tab.id === 'home' ? <Home overdue={overdue} /> : <Page />}
        </> : <><AppBar title={tab.label} /><section className="empty-card">
          <EmptyIllustration icon={Icon} sticker={tab.id === 'budget' ? 'avatar-wallet' : 'journal'} />
          <p>{tab.label} is coming soon.</p>
        </section></>} />
        {tab.id === 'more' && moreItems.filter(item => item.enabled && item.id in morePages).map(item =>
          <Route key={item.id} path={item.route} element={<>
            <AppBar title={item.label} back={() => void navigate("/more")} />{morePages[item.id as keyof typeof morePages]}
          </>} />)}
        {tab.id === 'budget' && tab.enabled && <>
          <Route path="/budget/extras" element={<><AppBar title="Budget extras" back={() => void navigate("/budget")} /><BudgetExtras /></>} />
          <Route path="/budget/summary" element={<><AppBar title="Monthly summary" back={() => void navigate("/budget")} /><MonthlySummary /></>} />
        </>}
        <Route path="*" element={<Navigate to={tab.route} replace />} />
      </Routes>
    </Suspense>
  </ScreenBoundary>
}

export function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  useKeyboardClearance()
  const [quickAdd, setQuickAdd] = useState(false)
  const nav = useRef<HTMLElement>(null)
  const shell = useRef<HTMLDivElement>(null)
  const active = tabFor(location.pathname)
  const [history, setHistory] = useState<Partial<Record<TabId, Location[]>>>(() => ({ [active]: [location] }))
  const panels = useRef<Partial<Record<TabId, HTMLElement>>>({})
  const scroll = useRef(new Map<string, number>())
  const lastBack = useRef(-Infinity)
  const back = useRef(() => {})
  const now = useMinuteClock()
  const groups = useTaskGroups(false)?.groups
  const overdue = useMemo(() => groups ? overdueCount(groups, now) : 0, [groups, now])
  const show = useToast()

  useLayoutEffect(() => {
    if (!nav.current || typeof ResizeObserver === 'undefined') return
    const element = nav.current
    const observer = new ResizeObserver(() => shell.current?.style.setProperty('--actual-tab-height', element.offsetHeight + 'px'))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    setHistory(previous => {
      const stack = previous[active] ?? [rootLocation(active)]
      const last = stack.at(-1)!
      if (last.key === location.key) return previous
      const prior = stack.findIndex(item => url(item) === url(location))
      return { ...previous, [active]: prior >= 0 ? [...stack.slice(0, prior), location] : [...stack, location] }
    })
  }, [active, location])

  useLayoutEffect(() => {
    if (active !== 'tasks') window.dispatchEvent(new Event('tidyberrie-task-tab-leave'))
    const panel = panels.current[active]
    if (panel) panel.scrollTop = scroll.current.get(url(location)) ?? 0
  }, [active, location])

  useLayoutEffect(() => {
    const stack = history[active] ?? [location]
    back.current = () => {
      const dialog = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1)
      if (dialog) {
        if (dialog.dispatchEvent(new Event('cancel', { cancelable: true })) && dialog.open) dialog.close()
        return
      }
      if (!document.dispatchEvent(new Event('tidyberrie-back', { cancelable: true }))) return
      const atRoot = url(location) === rootFor(active)
      const action = backAction(atRoot ? 1 : Math.max(stack.length, 2), active, Date.now(), lastBack.current)
      if (action === 'pop') {
        void navigate(stack.length > 1 ? url(stack.at(-2)!) : rootFor(active), { replace: true })
      } else if (action === 'home') {
        lastBack.current = -Infinity
        void navigate('/')
      } else if (action === 'exit') {
        void App.exitApp()
      } else {
        lastBack.current = Date.now()
        show({ message: 'Press back again to exit' })
      }
    }
  }, [active, history, location, navigate, show])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const listener = App.addListener('backButton', () => back.current())
    return () => { void listener.then(handle => handle.remove()).catch(() => {}) }
  }, [])

  if (location.pathname === '/settings/reminders') return <Navigate to={moreRoute('reminders')} replace />
  if (location.pathname === '/settings' && location.hash === '#backups') return <Navigate to={moreRoute('backups')} replace />
  if (location.pathname === '/settings' || location.pathname.startsWith('/settings/')) return <Navigate to="/more" replace />
  if (location.pathname === '/trash' || (location.pathname === '/tasks' && new URLSearchParams(location.search).has('trash'))) {
    return <Navigate to={moreRoute('trash')} replace />
  }

  return <div className="phone-shell" ref={shell}>
    <a className="skip-link" href="#main">Skip to content</a>
    {tabs.map(tab => (tab.id === active || history[tab.id]) && <main key={tab.id}
      id={tab.id === active ? 'main' : undefined} tabIndex={-1} hidden={tab.id !== active}
      className="tab-panel" onScroll={event => { if (tab.id === active) {
        scroll.current.set(url(location), event.currentTarget.scrollTop)
        event.currentTarget.toggleAttribute('data-scrolled', event.currentTarget.scrollTop > 0)
      } }} ref={element => { if (element) panels.current[tab.id] = element }}>

      <TabRoutes tab={tab} overdue={overdue} location={tab.id === active ? location : history[tab.id]!.at(-1)!} />
    </main>)}
    {features.tasks && (active === 'more' || !tabs.find(tab => tab.id === active)?.enabled) && <PlannerAddButton open={() => setQuickAdd(true)} />}
    {quickAdd && <QuickAdd draft={{ date: localDate(now) }} close={() => setQuickAdd(false)} />}
    <nav ref={nav} className="phone-tabs" aria-label="Main navigation">
      {tabs.map(({ id, label, icon: Icon, route }) => {
        const selected = active === id
        const count = id === 'tasks' ? overdue : 0
        const previous = history[id]?.at(-1)
        return <Link key={id} to={selected || !previous ? route : url(previous)}
          aria-current={selected ? 'page' : undefined}
          aria-label={count ? label + ', ' + count + ' overdue' : undefined}
          onClick={() => {
            lastBack.current = -Infinity
            if (selected) {
              scroll.current.delete(route)
              const panel = panels.current[id]
              if (panel) panel.scrollTop = 0
              setHistory(old => ({ ...old, [id]: [rootLocation(id)] }))
            }
          }}>
          <span className="tab-icon"><Icon size={22} aria-hidden fill={selected ? 'currentColor' : 'none'} />
            {count > 0 && <span className="tab-count" aria-hidden>{count > 99 ? '99+' : count}</span>}
          </span><span>{label}</span>
        </Link>
      })}
    </nav>
  </div>
}
