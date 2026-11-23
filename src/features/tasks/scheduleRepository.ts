import { liveQuery } from 'dexie'
import { db, table } from '../../shared/db/database'
import { compareScheduleTasks } from './model'
import { metadata } from '../../shared/db/repository'
import type { Records } from '../../shared/db/schemas'

type Schedule = Records['schedules']
type Draft = Omit<Schedule, keyof ReturnType<typeof metadata> | 'order'>
const schedules = table('schedules')
const tasks = table('tasks')
const subtasks = table('subtasks')
const exceptions = table('taskExceptions')

export function saveScheduleRecord(draft: Draft, id?: string) {
  return db.transaction('rw', schedules, async () => {
    const previous = id ? await schedules.get(id) : undefined
    if (id && (!previous || previous.deletedAt)) throw new Error('Schedule unavailable.')
    const rows = await schedules.toArray()
    if (rows.some(row => !row.deletedAt && row.id !== id && row.name.toLowerCase() === draft.name.toLowerCase())) {
      throw new Error('A schedule already uses that name.')
    }
    const stamp = metadata()
    const row = { ...stamp, ...previous, ...draft, updatedAt: stamp.updatedAt,
      order: previous?.order ?? rows.reduce((highest, item) => Math.max(highest, item.order), -1) + 1 }
    await schedules.put(row)
    return row
  })
}

export function duplicateScheduleRecord(id: string, name: string, days: number[]) {
  return db.transaction('rw', [schedules, tasks, subtasks], async () => {
    const source = await schedules.get(id)
    if (!source || source.deletedAt) throw new Error('Schedule unavailable.')
    const copy = await saveScheduleRecord({ name, days, color: source.color, icon: source.icon,
      startDate: source.startDate, endDate: source.endDate, paused: source.paused })
    const originalTasks = await tasks.where('scheduleId').equals(id).filter(task => !task.deletedAt).toArray()
    for (const original of originalTasks) {
      const duplicate = { ...original, ...metadata(), scheduleId: copy.id, status: 'todo' as const,
        actualMinutes: null, originalDate: null, rescheduleCount: 0 }
      await tasks.add(duplicate)
      const children = await subtasks.where('taskId').equals(original.id).filter(child => !child.deletedAt).toArray()
      await subtasks.bulkAdd(children.map(child => ({ ...child, ...metadata(), taskId: duplicate.id, done: false })))
    }
    return { copy, undo: () => setScheduleDeleted(copy.id, true).then(() => undefined) }
  })
}

export function setScheduleDeleted(id: string, deleted: boolean): Promise<() => Promise<void>> {
  return db.transaction('rw', [schedules, tasks, subtasks, exceptions], async () => {
    const schedule = await schedules.get(id)
    if (!schedule || !!schedule.deletedAt === deleted) throw new Error('Schedule unavailable.')
    if (!deleted && await schedules.filter(row => !row.deletedAt && row.name.toLowerCase() === schedule.name.toLowerCase()).first()) {
      throw new Error('A schedule already uses that name.')
    }
    const { updatedAt } = metadata()
    const deletedAt = deleted ? updatedAt : null
    await schedules.update(id, { deletedAt, updatedAt })
    const linked = await tasks.where('scheduleId').equals(id).filter(task => task.deletedAt === schedule.deletedAt).toArray()
    const ids = linked.map(task => task.id)
    await tasks.bulkPut(linked.map(task => ({ ...task, deletedAt, updatedAt })))
    if (ids.length) {
      await subtasks.where('taskId').anyOf(ids).filter(row => row.deletedAt === schedule.deletedAt).modify({ deletedAt, updatedAt })
      await exceptions.where('taskId').anyOf(ids).filter(row => row.deletedAt === schedule.deletedAt).modify({ deletedAt, updatedAt })
    }
    return () => setScheduleDeleted(id, !deleted).then(() => undefined)
  })
}

export function reorderScheduleTask(scheduleId: string, taskId: string, offset: number) {
  return db.transaction('rw', tasks, async () => {
    const target = await tasks.get(taskId)
    if (!target || target.deletedAt || target.scheduleId !== scheduleId) throw new Error('Task unavailable.')
    const peers = await tasks.where('scheduleId').equals(scheduleId).filter(item => !item.deletedAt &&
      item.startAt?.slice(11, 16) === target.startAt?.slice(11, 16)).toArray()
    peers.sort(compareScheduleTasks)
    const index = peers.findIndex(item => item.id === taskId)
    if (!peers[index + offset]) return
    ;[peers[index], peers[index + offset]] = [peers[index + offset], peers[index]]
    const { updatedAt } = metadata()
    await tasks.bulkPut(peers.map((item, scheduleOrder) => ({ ...item, scheduleOrder, updatedAt })))
  })
}

export function reorderSchedule(id: string, offset: number) {
  return db.transaction('rw', schedules, async () => {
    const rows = await schedules.orderBy('order').filter(row => !row.deletedAt).toArray()
    const index = rows.findIndex(row => row.id === id)
    const current = rows[index]
    const other = rows[index + offset]
    if (!current || !other) return
    const { updatedAt } = metadata()
    await schedules.bulkPut([{ ...current, order: other.order, updatedAt }, { ...other, order: current.order, updatedAt }])
  })
}

export function watchScheduleRecords(next: (rows: Schedule[]) => void, error: () => void, deleted = false) {
  const subscription = liveQuery(() => schedules.orderBy('order').filter(row => !!row.deletedAt === deleted).toArray()).subscribe({ next, error })
  return () => subscription.unsubscribe()
}
