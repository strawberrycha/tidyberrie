import { liveQuery } from 'dexie'
import { table } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import { recordSchemas } from '../../shared/db/schemas'
import { choices } from './model'
import type { DayThemeRecord, ThemeFields, ThemeScope } from './model'

const themes = table('dayThemes')
export function observeThemes(next: (values: DayThemeRecord[]) => void, error: () => void) {
  const subscription = liveQuery(() => themes.filter(record => !record.deletedAt).toArray()).subscribe({ next, error })
  return () => subscription.unsubscribe()
}

export function saveDefinition(value: ThemeFields, id?: string) {
  return themes.db.transaction('rw', themes, async () => {
    const previous = id ? await themes.get(id) : undefined
    if (id && (!previous?.catalog || previous.deletedAt)) throw new Error('Theme unavailable')
    const stamp = metadata()
    await themes.put(recordSchemas.dayThemes.parse({
      ...stamp, ...previous, ...value, catalog: true, updatedAt: stamp.updatedAt,
    }))
  })
}

async function softDelete(records: DayThemeRecord[], deletedAt: string) {
  await themes.bulkPut(records.map(value => ({ ...value, deletedAt, updatedAt: deletedAt })))
}

export function deleteDefinition(id: string) {
  return themes.db.transaction('rw', themes, async () => {
    const record = await themes.get(id)
    if (!record?.catalog || record.deletedAt) throw new Error('Theme unavailable')
    const related = await themes.where('themeKey').equals(id).filter(value => !value.deletedAt).toArray()
    const deletedAt = new Date().toISOString()
    const affected = [record, ...related]
    await softDelete(affected, deletedAt)
    return () => themes.db.transaction('rw', themes, async () => {
      const current = await themes.bulkGet(affected.map(value => value.id))
      if (current.some(value => value?.deletedAt !== deletedAt)) throw new Error('Theme changed')
      await themes.bulkPut(affected)
    })
  })
}

export function assignTheme(scope: ThemeScope, key: string) {
  return themes.db.transaction('rw', themes, async () => {
    const related = await themes.where(scope).filter(record => !record.deletedAt).toArray()
    const stamp = metadata()
    if (key) {
      const catalog = choices(await themes.filter(record => !!record.catalog && !record.deletedAt).toArray())
      const choice = catalog.find(value => value.key === key)
      if (!choice) throw new Error('Theme unavailable')
      const { name, icon, color } = choice
      await themes.add(recordSchemas.dayThemes.parse({ ...stamp, ...scope, name, icon, color, themeKey: key }))
    }
    await softDelete(related, stamp.updatedAt)
    return () => themes.db.transaction('rw', themes, async () => {
      const [old, active] = await Promise.all([
        themes.bulkGet(related.map(value => value.id)),
        themes.where(scope).filter(record => !record.deletedAt).toArray(),
      ])
      if (old.some(value => value?.deletedAt !== stamp.updatedAt)
        || (key ? active.length !== 1 || active[0].id !== stamp.id : active.length !== 0)) throw new Error('Assignment changed')
      if (key) await softDelete(active, new Date().toISOString())
      await themes.bulkPut(related)
    })
  })
}
