import type { Transaction } from 'dexie'
import type { Records } from './schemas'
import { defaultCategories } from '../../features/tasks/categoryData'
import { localTimestamp, timeOf } from '../../features/tasks/model'
import { defaultRepeat, encodeRepeat } from '../../features/tasks/recurrence'

export async function convertScheduleRecords(tx: Transaction, retireDefaults = true) {
  const categories = tx.table<Records['categories'], string>('categories')
  const tasks = tx.table<Records['tasks'], string>('tasks')
  const schedules = tx.table<Records['schedules'], string>('schedules')
  const exceptions = tx.table<Records['taskExceptions'], string>('taskExceptions')
  const subtasks = tx.table<Records['subtasks'], string>('subtasks')
  const rows = await tasks.toArray()
  const used = new Set(rows.map(task => task.categoryId))
  const defaults = new Map(defaultCategories().map(item => [item.id, item.name]))
  const stamp = new Date().toISOString()
  const knownNames = new Set<string>()
  await categories.toCollection().modify(item => {
    item.groupId ??= null
    if (retireDefaults && !item.deletedAt && defaults.get(item.id) === item.name && !used.has(item.id)) {
      item.deletedAt = stamp
      item.updatedAt = stamp
    }
    if (!item.deletedAt) knownNames.add(item.name.toLowerCase())
  })
  for (const schedule of await schedules.toArray()) {
    const linked = rows.filter(task => task.scheduleId === schedule.id)
    if (!linked.length) continue
    const categoryId = schedule.id
    const existingCategory = await categories.get(categoryId)
    let name = schedule.name.slice(0, 30).trim()
    for (let suffix = 2; knownNames.has(name.toLowerCase()); suffix++) {
      const marker = ' (' + suffix + ')'
      name = schedule.name.slice(0, 30 - marker.length) + marker
    }
    knownNames.add(name.toLowerCase())
    if (!existingCategory) await categories.add({
      id: categoryId, name, color: schedule.color, icon: schedule.icon, order: schedule.order,
      archived: false, groupId: null, createdAt: schedule.createdAt, updatedAt: stamp, deletedAt: schedule.deletedAt,
    })
    for (const task of linked) {
      const history = await exceptions.where('taskId').equals(task.id).toArray()
      const anchor = schedule.startDate ?? [task.startAt?.slice(0, 10) ?? task.createdAt.slice(0, 10),
        ...history.map(item => item.date)].sort()[0]
      const repeat = { ...defaultRepeat, mode: 'specific' as const, weekdays: schedule.days, until: schedule.endDate ?? '' }
      const scheduleMuted = schedule.paused || !!schedule.deletedAt
      const muted = scheduleMuted || !task.alertNotify
      await tasks.update(task.id, {
        categoryId, scheduleId: null, startAt: localTimestamp(anchor, timeOf(task.startAt)),
        endAt: task.endAt ? localTimestamp(anchor, timeOf(task.endAt)) : null,
        repeatRule: encodeRepeat(repeat, anchor, 1), alertNotify: !muted,
        reminders: muted ? [] : task.reminders.length ? task.reminders : [0], updatedAt: stamp,
      })
      if (muted) await subtasks.where('taskId').equals(task.id).modify(child => { delete child.reminder })
      await exceptions.where('taskId').equals(task.id).modify(item => {
        if (!item.override) return
        const notify = !scheduleMuted && item.override.alertNotify
        item.override = { ...item.override, scheduleId: null, categoryId, repeat, alertNotify: notify,
          reminders: notify ? item.override.reminders.length ? item.override.reminders : [0] : [],
          subtasks: notify ? item.override.subtasks : item.override.subtasks.map(child => ({ ...child, reminder: undefined })) }
      })
    }
  }
}
