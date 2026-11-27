import { liveQuery } from 'dexie'
import { db, table } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import type { RecordMetadata, Records } from '../../shared/db/schemas'

const groups = table('groups')
const categories = table('categories')
const tasks = table('tasks')
const subtasks = table('subtasks')
const exceptions = table('taskExceptions')
const tables = [groups, categories, tasks, subtasks, exceptions].map(item => db.table<RecordMetadata, string>(item.name))

// Capture only modified rows for Undo. Keep unrelated edits and reject conflicting changes.
async function write(action: () => Promise<void>) {
  return db.transaction('rw', tables, async () => {
    const before = await Promise.all(tables.map(target => target.toArray()))
    await action()
    const changes = await Promise.all(tables.map(async (target, index) => {
      const old = new Map(before[index].map(row => [row.id, row]))
      return (await target.toArray()).flatMap(row => {
        const previous = old.get(row.id)
        return JSON.stringify(previous) === JSON.stringify(row) ? [] : [{ row, previous }]
      })
    }))
    return () => db.transaction('rw', tables, async () => {
      for (const [index, target] of tables.entries()) for (const { row, previous } of changes[index]) {
        if (JSON.stringify(await target.get(row.id)) !== JSON.stringify(row)) throw new Error('The item changed after this action.')
        if (previous) await target.put(previous)
        else await target.delete(row.id)
      }
    })
  })
}

function requireActive<T extends RecordMetadata>(item: T | undefined) {
  if (!item || item.deletedAt) throw new Error('This item is unavailable.')
  return item
}
const nameKey = (name: string) => name.trim().toLowerCase()

export function watchGroupRecords(next: (items: Records['groups'][]) => void, error: () => void) {
  const subscription = liveQuery(() => groups.orderBy('order').filter(item => !item.deletedAt).toArray()).subscribe({ next, error })
  return () => subscription.unsubscribe()
}

export const editGroup = (draft: Pick<Records['groups'], 'name' | 'color'>, id?: string, categoryId?: string) =>
  write(async () => {
    const existing = id ? requireActive(await groups.get(id)) : undefined
    const all = await groups.toArray()
    if (all.some(row => !row.deletedAt && row.id !== id && nameKey(row.name) === nameKey(draft.name))) {
      throw new Error('A group already uses that name.')
    }
    const stamp = metadata()
    const group = { ...stamp, ...existing, ...draft, updatedAt: stamp.updatedAt,
      order: existing?.order ?? all.reduce((max, row) => Math.max(max, row.order), -1) + 1 }
    await groups.put(group)
    if (categoryId) {
      requireActive(await categories.get(categoryId))
      await categories.update(categoryId, { groupId: group.id, updatedAt: stamp.updatedAt })
    }
  })

export const assignCategory = (categoryId: string, groupId: string | null) =>
  write(async () => {
    requireActive(await categories.get(categoryId))
    if (groupId) requireActive(await groups.get(groupId))
    await categories.update(categoryId, { groupId, updatedAt: metadata().updatedAt })
  })

export const detachGroup = (id: string, remove: boolean) =>
  write(async () => {
    requireActive(await groups.get(id))
    const { updatedAt } = metadata()
    await categories.where('groupId').equals(id).filter(row => !row.deletedAt).modify({ groupId: null, updatedAt })
    if (remove) await groups.update(id, { deletedAt: updatedAt, updatedAt })
  })

export const copyCategory = (id: string) =>
  write(async () => {
    const source = requireActive(await categories.get(id))
    const name = source.name.slice(0, 23) + ' (copy)'
    if (await categories.filter(row => !row.deletedAt && nameKey(row.name) === nameKey(name)).first()) {
      throw new Error('A category already uses that name.')
    }
    const stamp = metadata()
    await categories.add({ ...source, ...stamp, name, archived: false })
    for (const task of await tasks.where('categoryId').equals(id).filter(row => !row.deletedAt).toArray()) {
      const copy = { ...task, ...metadata(), categoryId: stamp.id, status: 'todo' as const,
        actualMinutes: null, originalDate: null, rescheduleCount: 0 }
      await tasks.add(copy)
      const children = await subtasks.where('taskId').equals(task.id).filter(row => !row.deletedAt).toArray()
      await subtasks.bulkAdd(children.map(child => ({ ...child, ...metadata(), taskId: copy.id, done: false })))
    }
  })

export const removeCategory = (id: string, withTasks: boolean) =>
  write(async () => {
    requireActive(await categories.get(id))
    const { updatedAt } = metadata()
    await categories.update(id, { deletedAt: updatedAt, updatedAt })
    const linked = tasks.where('categoryId').equals(id).filter(row => !row.deletedAt)
    if (!withTasks) { await linked.modify({ categoryId: null, updatedAt }); return }
    const ids = (await linked.toArray()).map(row => row.id)
    await linked.modify({ deletedAt: updatedAt, updatedAt })
    if (!ids.length) return
    await subtasks.where('taskId').anyOf(ids).filter(row => !row.deletedAt).modify({ deletedAt: updatedAt, updatedAt })
    await exceptions.where('taskId').anyOf(ids).filter(row => !row.deletedAt).modify({ deletedAt: updatedAt, updatedAt })
  })

export const recoverCategory = (id: string) =>
  write(async () => {
    const category = await categories.get(id)
    if (!category?.deletedAt) throw new Error('Category is unavailable.')
    if (await categories.filter(row => !row.deletedAt && nameKey(row.name) === nameKey(category.name)).first()) {
      throw new Error('A category already uses that name.')
    }
    const { updatedAt } = metadata()
    const activeGroup = category.groupId ? await groups.get(category.groupId) : undefined
    await categories.update(id, { deletedAt: null, updatedAt, groupId: activeGroup?.deletedAt ? null : activeGroup?.id ?? null })
    const linked = tasks.where('categoryId').equals(id).filter(row => row.deletedAt === category.deletedAt)
    const ids = (await linked.toArray()).map(row => row.id)
    await linked.modify({ deletedAt: null, updatedAt })
    if (!ids.length) return
    await subtasks.where('taskId').anyOf(ids).filter(row => row.deletedAt === category.deletedAt).modify({ deletedAt: null, updatedAt })
    await exceptions.where('taskId').anyOf(ids).filter(row => row.deletedAt === category.deletedAt).modify({ deletedAt: null, updatedAt })
  })
