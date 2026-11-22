import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { Shell } from './Shell'
import { backAction, moreItems, tabs } from './navigation'
import { useMinuteClock } from './useMinuteClock'
import { ToastProvider } from '../shared/ui/Toast'
import { emptyTask } from '../features/tasks/input'
import { storedTask } from '../features/tasks/model'

const bridge = vi.hoisted(() => ({
  listeners: new Map<string, (state: { isActive: boolean }) => void>(),
  exitApp: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))
vi.mock('@capacitor/app', () => ({ App: { exitApp: bridge.exitApp, addListener: async (name: string, callback: (state: { isActive: boolean }) => void) => {
  bridge.listeners.set(name, callback)
  return { remove: () => { if (bridge.listeners.get(name) === callback) bridge.listeners.delete(name) } }
} } }))
vi.mock('../features/settings/AppLock', () => ({ LockSettings: () => <p>Lock settings</p> }))
vi.mock('../features/settings/BackupNudge', () => ({ BackupNudge: () => null }))
vi.mock('../features/dayTheme/Home', () => ({ Home: () => <h1>Home fixture</h1> }))
vi.mock('../features/tasks/Tasks', () => ({
  Tasks: function TaskFixture() {
    const [value, setValue] = useState('')
    return <label>Filter<input value={value} onChange={event => setValue(event.target.value)} /></label>
  },
}))
vi.mock('../features/tasks/useTasks', () => ({
  useTaskGroups: () => ({
    groups: [{
      task: { ...storedTask({ ...emptyTask('2000-01-01'), title: 'Overdue item' }, 1), id: 'fixture' },
      subtasks: [], exceptions: [],
    }],
  }),
}))

afterEach(() => { cleanup(); vi.useRealTimers(); bridge.exitApp.mockClear() })

it('drives tab order and More from config, shows one overdue item, and retains the Tasks filter', async () => {
  render(<MemoryRouter initialEntries={['/tasks']}><ToastProvider><Shell /></ToastProvider></MemoryRouter>)
  expect(tabs.map(tab => tab.label)).toEqual(['Home', 'Tasks', 'Calendar', 'Budget', 'More'])
  expect(moreItems.find(item => item.id === 'meals')?.enabled).toBe(false)
  const filter = await screen.findByRole('textbox', { name: 'Filter' })
  fireEvent.change(filter, { target: { value: 'Library' } })
  expect(screen.getByRole('link', { name: 'Tasks, 1 overdue' })).toHaveAttribute('aria-current', 'page')
  fireEvent.click(screen.getByRole('link', { name: 'Budget' }))
  expect(await screen.findByText('Budget is coming soon.')).toBeVisible()
  fireEvent.click(screen.getByRole('link', { name: 'Tasks, 1 overdue' }))
  expect(screen.getByRole('textbox', { name: 'Filter' })).toHaveValue('Library')
  fireEvent.click(screen.getByRole('link', { name: 'More' }))
  expect(await screen.findByText('Coming soon')).toBeVisible()
  expect(screen.queryByRole('link', { name: /Meals/ })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Backup and Restore' })).toHaveAttribute('href', '/more/backups')
})

it('handles native Back inside a tab and exits on the second Home press', async () => {
  render(<MemoryRouter initialEntries={['/more/security']}><ToastProvider><Shell /></ToastProvider></MemoryRouter>)
  const press = () => act(() => bridge.listeners.get('backButton')?.({ isActive: true }))
  expect(await screen.findByText('Lock settings')).toBeVisible()
  press()
  expect(await screen.findByRole('heading', { name: 'More' })).toBeVisible()
  press()
  expect(await screen.findByRole('heading', { name: 'Home fixture' })).toBeVisible()
  press()
  expect(screen.getByText('Press back again to exit')).toBeVisible()
  press()
  expect(bridge.exitApp).toHaveBeenCalledOnce()
  expect(backAction(1, 'home', 3000, 0)).toBe('prompt')
})

it('ticks at midnight and refreshes immediately on Android resume', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 58))
  function Clock() { const now = useMinuteClock(); return <output>{now.getDate()}</output> }
  render(<Clock />)
  expect(screen.getByRole('status')).toHaveTextContent('31')
  act(() => vi.advanceTimersByTime(2000))
  expect(screen.getByRole('status')).toHaveTextContent('1')
  vi.setSystemTime(new Date(2027, 0, 5, 12))
  act(() => bridge.listeners.get('appStateChange')?.({ isActive: true }))
  expect(screen.getByRole('status')).toHaveTextContent('5')
})
