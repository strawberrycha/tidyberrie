import type { Theme } from '../../shared/theme/tokens'
import { changeSettings, deleteSettings, findOrCreateSettings, restoreSettings, saveStoragePermission } from './repository'

function defaults(key: 'preferences' | 'undo-demo', theme: Theme) {
  return {
    key, theme, storagePersistent: null, budgetView: 'monthly' as const,
    avatar: '', currency: 'PHP' as const, weekStart: 1, dashboardCards: [], backupReminder: false,
  }
}

let persistenceRequest: Promise<boolean> | undefined

async function requestPersistence() {
  try {
    return await navigator.storage?.persist?.() ?? false
  } catch {
    return false
  }
}

export async function initializeSettings() {
  const theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sakura' : 'strawberry'
  const settings = await findOrCreateSettings(defaults('preferences', theme))
  if (settings.storagePersistent !== null) return settings
  persistenceRequest ??= requestPersistence()
  return saveStoragePermission(settings.id, await persistenceRequest)
}

export function loadUndoDemo() {
  return findOrCreateSettings(defaults('undo-demo', 'strawberry'))
}

export function setTheme(id: string, theme: Theme) {
  return changeSettings(id, { theme })
}

export function setWeekStart(id: string, weekStart: number) {
  return changeSettings(id, { weekStart })
}

export const deleteDemo = deleteSettings
export const restoreDemo = restoreSettings
