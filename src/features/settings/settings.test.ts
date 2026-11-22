import 'fake-indexeddb/auto'
import { afterEach, expect, it, vi } from 'vitest'
import { db } from '../../shared/db/database'
import { initializeSettings, setWeekStart } from './service'

afterEach(async () => {
  vi.unstubAllGlobals()
  await db.delete()
})

it('defaults new preferences to Sunday and retains an explicitly selected Monday', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  const settings = await initializeSettings()
  expect(settings.weekStart).toBe(0)
  await setWeekStart(settings.id, 1)
  expect((await initializeSettings()).weekStart).toBe(1)
})
