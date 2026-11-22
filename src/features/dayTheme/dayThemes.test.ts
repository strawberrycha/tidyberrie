import 'fake-indexeddb/auto'
import { afterEach, expect, it } from 'vitest'
import { table } from '../../shared/db/database'
import { resolveDayTheme, themeIndex } from './model'
import { deleteDayTheme, saveDayTheme, setThemeAssignment } from './service'

const themes = table('dayThemes')
afterEach(() => themes.clear())

it('resolves date overrides, then weekday defaults, then no theme', async () => {
  await setThemeAssignment({ weekday: 1 }, 'study')
  const undo = await setThemeAssignment({ date: '2026-11-23' }, 'work')
  let index = themeIndex(await themes.toArray())
  expect(resolveDayTheme(index, '2026-11-23', 1)?.name).toBe('Work')
  expect(resolveDayTheme(index, '2026-11-30', 1)?.name).toBe('Study')
  expect(resolveDayTheme(index, '2026-11-24', 2)).toBeUndefined()
  await undo()
  index = themeIndex(await themes.toArray())
  expect(resolveDayTheme(index, '2026-11-23', 1)?.name).toBe('Study')
})

it('updates assignments after edits and soft-deletes and restores a custom theme with its assignments', async () => {
  await saveDayTheme({ name: '  Focus  ', icon: 'star', color: 'berry' })
  const [custom] = await themes.toArray()
  expect(custom.name).toBe('Focus')
  await setThemeAssignment({ date: '2026-11-23' }, custom.id)
  await saveDayTheme({ name: 'Read', icon: 'book', color: 'mint' }, custom.id)
  expect(themeIndex(await themes.toArray()).dated.get('2026-11-23')?.name).toBe('Read')
  const undo = await deleteDayTheme(custom.id)
  expect((await themes.toArray()).every(value => value.deletedAt)).toBe(true)
  expect(themeIndex(await themes.toArray()).dated.size).toBe(0)
  await undo()
  expect(themeIndex(await themes.toArray()).dated.get('2026-11-23')?.name).toBe('Read')
  expect(() => setThemeAssignment({ date: '2026-02-30' }, 'work')).toThrow()
})
