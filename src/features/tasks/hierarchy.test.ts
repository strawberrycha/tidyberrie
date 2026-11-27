import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it, vi } from 'vitest'
import { openDatabase, table } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import { defaultCategories } from './categoryData'
import { saveCategory } from './categoryService'
import { deleteCategory, deleteCategoryAndTasks, deleteGroup, duplicateCategory, moveCategoryToGroup, moveTaskToCategory, restoreCategory, saveGroup, ungroup } from './hierarchyService'
import { emptyTask } from './input'
import { storedTask } from './model'
import { expandDates } from './recurrence'
import { watchTasks } from './service'

it('starts with no categories or groups', async () => {
  const database = openDatabase('empty-' + crypto.randomUUID())
  try {
    expect(await table('categories', database).count()).toBe(0)
    expect(await table('groups', database).count()).toBe(0)
  } finally { await database.delete() }
})

it('converts a legacy weekday plan and preserves the task, child and exception identities', async () => {
  const name = 'v10-' + crypto.randomUUID()
  const old = new Dexie(name)
  old.version(10).stores({
    categories: 'id,order,deletedAt', schedules: 'id,order,deletedAt',
    tasks: 'id,startAt,endAt,status,deletedAt,categoryId,scheduleId',
    subtasks: 'id,taskId,dueAt,deletedAt', taskExceptions: 'id,taskId,date,[taskId+date],movedTo,deletedAt',
  })
  const [used, unused] = defaultCategories()
  const schedule = { ...metadata(), name: 'School', color: 'rose', icon: 'book', days: [1], order: 0,
    paused: true, startDate: '2026-11-23', endDate: '2026-12-07' }
  const task = { ...metadata(), ...storedTask({ ...emptyTask('2026-11-23'), title: 'Read', startTime: '08:00',
    allDay: false, categoryId: used.id, scheduleId: schedule.id, alertNotify: true, reminders: [0] }, 0) }
  const subtask = { ...metadata(), taskId: task.id, title: 'Part', order: 0, done: false, reminder: 0 }
  const exception = { ...metadata(), taskId: task.id, date: '2026-11-30', action: 'completed', movedTo: null,
    subtaskStates: { [subtask.id]: true } }
  await old.table('categories').bulkAdd([used, unused])
  await old.table('schedules').add(schedule)
  await old.table('tasks').add(task)
  await old.table('subtasks').add(subtask)
  await old.table('taskExceptions').add(exception)
  old.close()
  const upgraded = openDatabase(name)
  try {
    const converted = await table('tasks', upgraded).get(task.id)
    expect(upgraded.verno).toBe(11)
    expect(converted).toMatchObject({ title: 'Read', scheduleId: null, reminders: [], alertNotify: false })
    expect(expandDates(converted!.repeatRule!, '2026-11-23', '2026-11-23', '2026-12-14'))
      .toEqual(['2026-11-23', '2026-11-30', '2026-12-07'])
    expect(await table('categories', upgraded).get(converted!.categoryId!)).toMatchObject({ name: 'School', groupId: null })
    expect((await table('categories', upgraded).get(used.id))?.deletedAt).toBeNull()
    expect((await table('categories', upgraded).get(unused.id))?.deletedAt).toBeTruthy()
    expect(await table('subtasks', upgraded).get(subtask.id)).toMatchObject({ id: subtask.id, title: 'Part' })
    expect(await table('taskExceptions', upgraded).get(exception.id)).toEqual(exception)
    expect(await table('schedules', upgraded).get(schedule.id)).toEqual(schedule)
  } finally { await upgraded.delete() }
})

it('supports category and group operations with undo and one task watcher update per atomic bulk move', async () => {
  await saveCategory({ name: ' Focus ', color: 'rose', icon: 'book' })
  const category = (await table('categories').toArray())[0]
  const undoGroup = await saveGroup({ name: ' Work ', color: 'rose' }, undefined, category.id)
  const group = (await table('groups').toArray())[0]
  await expect(saveGroup({ name: 'work', color: 'rose' })).rejects.toThrow('already uses')
  expect((await table('categories').get(category.id))?.groupId).toBe(group.id)
  const undoUngroup = await ungroup(group.id)
  expect((await table('categories').get(category.id))?.groupId).toBeNull()
  await undoUngroup()
  const undoDeleteGroup = await deleteGroup(group.id)
  expect((await table('groups').get(group.id))?.deletedAt).toBeTruthy()
  await undoDeleteGroup()
  const undoDetach = await moveCategoryToGroup(category.id, null)
  await undoDetach()
  await undoGroup()
  const task = { ...metadata(), ...storedTask({ ...emptyTask('2026-11-27'), title: 'Read' }, 0) }
  await table('tasks').add(task)
  const next = vi.fn()
  const stop = watchTasks(false, next, vi.fn())
  await vi.waitFor(() => expect(next).toHaveBeenCalledTimes(1))
  const move = await moveTaskToCategory(task.id, category.id)
  await vi.waitFor(() => expect(next).toHaveBeenCalledTimes(2))
  stop()
  expect((await table('tasks').get(task.id))?.categoryId).toBe(category.id)
  await move.undo()
  await moveTaskToCategory(task.id, category.id)
  const undoCopy = await duplicateCategory(category.id)
  expect(await table('tasks').count()).toBe(2)
  await undoCopy()
  const undoDelete = await deleteCategory(category.id)
  expect((await table('tasks').get(task.id))?.categoryId).toBeNull()
  await undoDelete()
  await deleteCategoryAndTasks(category.id)
  expect((await table('tasks').get(task.id))?.deletedAt).toBeTruthy()
  const undoRestore = await restoreCategory(category.id)
  expect((await table('tasks').get(task.id))?.deletedAt).toBeNull()
  await undoRestore()
  expect((await table('tasks').get(task.id))?.deletedAt).toBeTruthy()
})
