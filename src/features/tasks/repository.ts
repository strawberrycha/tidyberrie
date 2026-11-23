import { liveQuery } from 'dexie'
import { db, table } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import { recordSchemas } from '../../shared/db/schemas'
import type { Subtask, TaskException, TaskGroup } from './model'

const tasks = table('tasks')
const subtasks = table('subtasks')
const exceptions = table('taskExceptions')
const settings = table('settings')
const tables = [tasks, subtasks, exceptions]
export const inTaskTransaction = <T>(operation: () => Promise<T>) => db.transaction('rw', tables, operation)
export const taskTitles = async (date: string) => (await tasks.filter(item => !item.deletedAt && item.startAt?.slice(0, 10) === date).toArray()).map(item => item.title)

export async function readGroups(deleted = false): Promise<TaskGroup[]> {
  return db.transaction('r', tables, async () => {
    const items = deleted
      ? await tasks.where('deletedAt').above('').toArray()
      : await tasks.filter(item => item.deletedAt === null).toArray()
    const ids = items.map(item => item.id)
    const children = await subtasks.where('taskId').anyOf(ids).toArray()
    const changes = await exceptions.where('taskId').anyOf(ids).toArray()
    const byParent = <T extends { taskId: string }>(records: T[]) => {
      const map = new Map<string, T[]>()
      for (const item of records) {
        const group = map.get(item.taskId) ?? []
        group.push(item)
        map.set(item.taskId, group)
      }
      return map
    }
    const childGroups = byParent(children)
    const changeGroups = byParent(changes)
    return items.map(task => ({ task, subtasks: childGroups.get(task.id) ?? [], exceptions: changeGroups.get(task.id) ?? [] }))
  })
}

export function watchGroups(deleted: boolean, next: (groups: TaskGroup[]) => void, error: () => void) {
  const subscription = liveQuery(() => readGroups(deleted)).subscribe({ next, error })
  return () => subscription.unsubscribe()
}

export async function readGroup(id: string): Promise<TaskGroup | undefined> {
  const task = await tasks.get(id)
  if (!task) return
  return { task, subtasks: await subtasks.where('taskId').equals(id).toArray(), exceptions: await exceptions.where('taskId').equals(id).toArray() }
}

async function writeGroup(id: string, group?: TaskGroup) {
  if (!group) {
    await erase(id)
    return
  }
  const parsed = recordSchemas.tasks.parse(group.task)
  const children = group.subtasks.map(item => recordSchemas.subtasks.parse(item))
  const changes = group.exceptions.map(item => recordSchemas.taskExceptions.parse(item))
  const existingChildren = await subtasks.bulkGet(children.map(item => item.id))
  if (existingChildren.some(item => item && item.taskId !== id)) throw new Error('Subtask belongs to another task')
  const saved = await readGroup(id)
  await tasks.put(parsed)
  await reconcile(saved?.subtasks ?? [], children, subtasks)
  await reconcile(saved?.exceptions ?? [], changes, exceptions)
}

async function reconcile<T extends Subtask | TaskException>(
  previous: T[], next: T[],
  target: { bulkPut(values: T[]): Promise<unknown>; bulkDelete(ids: string[]): Promise<unknown> },
) {
  const ids = new Set(next.map(item => item.id))
  const removed = previous.filter(item => !ids.has(item.id)).map(item => item.id)
  if (removed.length) await target.bulkDelete(removed)
  if (next.length) await target.bulkPut(next)
}

export function changeGroup(id: string | undefined, mutate: (previous: TaskGroup | undefined, stamp: ReturnType<typeof metadata>) => TaskGroup, rememberCategory = false) {
  return db.transaction('rw', rememberCategory ? [...tables, settings] : tables, async () => {
    const previous = id ? await readGroup(id) : undefined
    const stamp = metadata()
    const next = mutate(previous, stamp)
    await writeGroup(next.task.id, next)
    if (rememberCategory) {
      const preferences = await settings.get({ key: 'preferences' })
      if (preferences) await settings.update(preferences.id, { lastCategoryId: next.task.categoryId, updatedAt: stamp.updatedAt })
    }
    const committed = await readGroup(next.task.id)
    return async () => db.transaction('rw', tables, async () => {
      const current = await readGroup(next.task.id)
      if (JSON.stringify(current) !== JSON.stringify(committed)) throw new Error('Task changed')
      await writeGroup(next.task.id, previous)
    })
  })
}

async function erase(id: string) {
  await subtasks.where('taskId').equals(id).delete()
  await exceptions.where('taskId').equals(id).delete()
  await tasks.delete(id)
}

export function permanentlyDelete(id: string) {
  return db.transaction('rw', tables, async () => {
    if (!(await tasks.get(id))?.deletedAt) throw new Error('Task is not in Trash')
    await erase(id)
  })
}

export function purgeTasks(now = new Date()) {
  const cutoff = now.valueOf() - 30 * 86400000
  return db.transaction('rw', tables, async () => {
    const old = await tasks.where('deletedAt').above('').filter(task => Date.parse(task.deletedAt!) < cutoff).primaryKeys()
    for (const id of old) await erase(id)
    await subtasks.where('deletedAt').above('').filter(item => Date.parse(item.deletedAt!) < cutoff).delete()
    await exceptions.where('deletedAt').above('').filter(item => Date.parse(item.deletedAt!) < cutoff).delete()
    return old.length
  })
}
