import { liveQuery } from 'dexie'
import { db, table } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import type { Records } from '../../shared/db/schemas'

type Category = Records['categories']
const categories = table('categories')
const settings = table('settings')
export function watchLastCategory(next: (id: string | null) => void) {
  const subscription = liveQuery(async () => (await settings.get({ key: 'preferences' }))?.lastCategoryId ?? null)
    .subscribe({ next, error: () => next(null) })
  return () => subscription.unsubscribe()
}

export function watchCategories(next: (categories: Category[]) => void, error: () => void, deleted = false) {
  const subscription = liveQuery(() => categories.orderBy('order').filter(item => !!item.deletedAt === deleted).toArray())
    .subscribe({ next, error })
  return () => subscription.unsubscribe()
}

export function changeCategory(id: string | undefined, update: (current: Category | undefined, all: Category[]) => Omit<Category, keyof ReturnType<typeof metadata>>) {
  return db.transaction('rw', categories, async () => {
    const all = await categories.toArray()
    const previous = id ? all.find(item => item.id === id && !item.deletedAt) : undefined
    if (id && !previous) throw new Error('Category is unavailable.')
    const stamp = metadata()
    const next = { ...stamp, ...previous, ...update(previous, all), updatedAt: stamp.updatedAt }
    await categories.put(next)
    return async () => db.transaction('rw', categories, async () => {
      if (JSON.stringify(await categories.get(next.id)) !== JSON.stringify(next)) throw new Error('Category changed.')
      if (previous) await categories.put(previous)
      else await categories.delete(next.id)
    })
  })
}

export function reorderCategory(id: string, direction: -1 | 1) {
  return db.transaction('rw', categories, async () => {
    const all = await categories.orderBy('order').filter(item => !item.archived && !item.deletedAt).toArray()
    const index = all.findIndex(item => item.id === id)
    const current = all[index]
    const neighbor = all[index + direction]
    if (!current || !neighbor) return
    const { updatedAt } = metadata()
    await categories.bulkPut([{ ...current, order: neighbor.order, updatedAt }, { ...neighbor, order: current.order, updatedAt }])
  })
}
