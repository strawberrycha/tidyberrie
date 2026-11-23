import { Archive, Bell, CalendarDays, Ellipsis, Folder, House, Info, ListTodo, Palette, Shield, Soup, Upload, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { features } from './features'

type Entry = { id: string; label: string; route: string; icon: LucideIcon; enabled: boolean }
export const tabs = [
  { id: 'home', label: 'Home', route: '/', icon: House, enabled: features.home },
  { id: 'tasks', label: 'Tasks', route: '/tasks', icon: ListTodo, enabled: features.tasks },
  { id: 'calendar', label: 'Calendar', route: '/calendar', icon: CalendarDays, enabled: features.calendar },
  { id: 'budget', label: 'Budget', route: '/budget', icon: Wallet, enabled: features.budget },
  { id: 'more', label: 'More', route: '/more', icon: Ellipsis, enabled: true },
] as const satisfies readonly Entry[]
export const moreGroups = [
  { label: 'Plan and Track', items: [{ id: 'meals', label: 'Meals', route: '/more/meals', icon: Soup, enabled: false }] },
  { label: 'Organize', items: [{ id: 'trash', label: 'Trash', route: '/more/trash', icon: Archive, enabled: features.tasks }, { id: 'categories', label: 'Categories', route: '/more/categories', icon: Folder, enabled: features.tasks }] },
  { label: 'App', items: [
    { id: 'reminders', label: 'Reminders and Alarms', route: '/more/reminders', icon: Bell, enabled: true },
    { id: 'appearance', label: 'Appearance', route: '/more/appearance', icon: Palette, enabled: true },
    { id: 'backups', label: 'Backup and Restore', route: '/more/backups', icon: Upload, enabled: true },
    { id: 'security', label: 'Security', route: '/more/security', icon: Shield, enabled: true },
    { id: 'about', label: 'About', route: '/more/about', icon: Info, enabled: true },
  ] },
] as const satisfies readonly { label: string; items: readonly Entry[] }[]
export type TabId = typeof tabs[number]['id']
export const moreItems: readonly Entry[] = moreGroups.flatMap(group => [...group.items] as Entry[])
export const tabFor = (path: string) => tabs.find(tab => tab.route !== '/' &&
  (path === tab.route || path.startsWith(tab.route + '/')))?.id ?? 'home'
export const moreRoute = (id: string) => moreItems.find(item => item.id === id)!.route
export function backAction(depth: number, tab: TabId, now: number, last: number) {
  if (depth > 1) return 'pop'
  if (tab !== 'home') return 'home'
  return now - last <= 2000 ? 'exit' : 'prompt'
}
