import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { db, openDatabase, table } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import { emptyTask, newSubtask } from './input'
import { overdueCount, smartRows } from './lists'
import { progress, storedTask, taskValue } from './model'
import { defaultRepeat } from './recurrence'
import { readGroups } from './repository'
import { archiveCategory, moveCategory, saveCategory } from './categoryService'
import { initializeSettings } from '../settings/service'
import { applyBulkTaskChange, watchTasks, changeCompletion, changeTaskStatus, duplicateTask, rescheduleTask, deleteTask, permanentlyDeleteTask, purgeTasks, restoreTask, saveTask } from './service'

const today = '2026-11-22'
const now = new Date(2026, 10, 22, 15)
const draft = () => ({ ...emptyTask(today), title: ' My task ' })
const child = (title: string) => ({ ...newSubtask(), title })
const group = async () => (await readGroups())[0]

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now) })
afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  await Promise.all(db.tables.map(target => target.clear()))
})

it('validates local dates and reminder times without rejecting existing overdue tasks', async () => {
  const previous = { ...draft(), startDate: '2026-11-21' }
  expect(() => saveTask(previous, 1)).toThrow('Pick today or a later date.')
  expect(() => saveTask({ ...previous, repeat: { ...defaultRepeat, mode: 'daily' } }, 1)).toThrow('Pick today or a later date.')
  const timed = { ...draft(), allDay: false, reminders: [0] as const }
  expect(() => saveTask({ ...timed, reminders: [...timed.reminders], startTime: '14:59' }, 1)).toThrow('That time has already passed.')
  await saveTask({ ...timed, reminders: [...timed.reminders], startTime: '15:01' }, 1)
  const { task } = await group()
  vi.setSystemTime(new Date(2026, 10, 23, 0, 0))
  const overdue = taskValue(await group(), today)
  await saveTask({ ...overdue, title: 'Updated overdue' }, 1, task.id)
  await expect(saveTask({ ...overdue, startDate: previous.startDate }, 1, task.id)).rejects.toThrow('Pick today or a later date.')
  await deleteTask(task.id)
  await restoreTask(task.id)
  expect((await group()).task.title).toBe('Updated overdue')
})

it('validates category names, reorders, and archives with an exact undo', async () => {
  const sample = { name: '  Reading ', color: 'rose', icon: 'book' }
  expect(() => saveCategory({ ...sample, name: ' ' })).toThrow('Enter a category name.')
  expect(() => saveCategory({ ...sample, name: 'a'.repeat(31) })).toThrow('Use at most 30 characters.')
  await saveCategory(sample)
  await expect(saveCategory({ ...sample, name: 'reading' })).rejects.toThrow('already uses')
  const reading = await table('categories').filter(item => item.name === 'Reading').first()
  await saveCategory({ ...sample, name: 'Music' })
  await moveCategory(reading!.id, 1)
  const before = await table('categories').get(reading!.id)
  const undo = await archiveCategory(reading!.id, true)
  expect((await table('categories').get(reading!.id))?.archived).toBe(true)
  await undo()
  expect(await table('categories').get(reading!.id)).toEqual(before)
  await archiveCategory(reading!.id, true)
  await archiveCategory(reading!.id, false)
  expect((await table('categories').get(reading!.id))?.archived).toBe(false)
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  await initializeSettings()
  await saveTask({ ...draft(), categoryId: reading!.id }, 0)
  expect((await table('settings').get({ key: 'preferences' }))?.lastCategoryId).toBe(reading!.id)
})

it('treats postponed as open, skips without counting as overdue, and changes occurrences independently', async () => {
  await saveTask({ ...draft(), optional: true, repeat: { ...defaultRepeat, mode: 'daily' } }, 0)
  const { task } = await group()
  await changeTaskStatus(task.id, today, 'skipped')
  expect((await group()).exceptions[0].action).toBe('skipped')
  expect(smartRows(await readGroups(), 'Today', now)).toHaveLength(0)
  const tomorrow = '2026-11-23'
  await rescheduleTask(task.id, tomorrow, '2026-11-24', now)
  expect(taskValue(await group(), today, tomorrow)).toMatchObject({
    status: 'postponed', originalDate: tomorrow, startDate: '2026-11-24', rescheduleCount: 1,
  })
  expect(smartRows(await readGroups(), 'Upcoming', now).some(row => row.value.status === 'postponed')).toBe(true)
  await changeTaskStatus(task.id, tomorrow, 'in_progress')
  expect(taskValue(await group(), today, tomorrow)).toMatchObject({ status: 'in_progress', originalDate: null })
  expect((await group()).task.status).toBe('todo')
  expect(overdueCount(await readGroups(), new Date(2026, 10, 25, 12))).toBe(0)
})

it('duplicates overdue timed tasks into today, clears completion, and avoids an exact title match', async () => {
  await saveTask({ ...draft(), allDay: false, startTime: '09:00', actualMinutes: 20,
    subtasks: [{ ...child('Part'), done: true }] }, 0)
  const { task } = await group()
  vi.setSystemTime(new Date(2026, 10, 23, 15))
  await saveTask({ ...draft(), startDate: '2026-11-23' }, 0)
  const copy = await duplicateTask(task.id, 0)
  expect(copy.value).toMatchObject({ title: 'My task (copy)', allDay: true, startTime: '', startDate: '2026-11-23',
    status: 'todo', actualMinutes: null, rescheduleCount: 0, subtasks: [{ title: 'Part', done: false }] })
  await copy.undo()
  expect(await table('tasks').get(copy.id)).toBeUndefined()
})

it('commits bulk changes and undo as one reminder watch notification each', async () => {
  const [a, b] = ['First', 'Second']
  await saveTask({ ...draft(), title: a, reminders: [0] }, 0)
  await saveTask({ ...draft(), title: b, reminders: [0] }, 0)
  const previous = await readGroups()
  const targets = previous.map(item => ({ id: item.task.id }))
  const reconcile = vi.fn()
  const stop = watchTasks(false, reconcile, vi.fn())
  try {
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1))
    reconcile.mockClear()
    const done = await applyBulkTaskChange(targets, { kind: 'done' }, now)
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1))
    expect((await readGroups()).map(item => item.task.status)).toEqual(['done', 'done'])
    reconcile.mockClear()
    await done.undo()
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1))
    expect(await readGroups()).toEqual(previous)
    await expect(applyBulkTaskChange([targets[0], { id: crypto.randomUUID() }], { kind: 'skip' }, now)).rejects.toThrow('Task unavailable')
    expect(await readGroups()).toEqual(previous)
    const skipped = await applyBulkTaskChange(targets, { kind: 'skip' }, now)
    expect((await readGroups()).every(item => item.task.status === 'skipped')).toBe(true)
    await skipped.undo()
    expect(await readGroups()).toEqual(previous)
  } finally {
    stop()
  }
})

it('applies category to a series and can delete multiple occurrences or one series with exact undo', async () => {
  await saveTask({ ...draft(), repeat: { ...defaultRepeat, mode: 'daily' } }, 0)
  await saveCategory({ name: 'Daily', color: 'mint', icon: 'leaf' })
  const category = await table('categories').filter(item => item.name === 'Daily').first()
  const previous = await group()
  const { id } = previous.task
  const targets = [{ id, occurrence: today }, { id, occurrence: '2026-11-23' }]
  const categorize = await applyBulkTaskChange(targets, { kind: 'category', categoryId: category!.id }, now)
  expect(categorize.count).toBe(1)
  expect((await group()).task.categoryId).toBe(category!.id)
  await categorize.undo()
  const occurrenceDelete = await applyBulkTaskChange(targets, { kind: 'delete', scope: 'occurrence' }, now)
  expect((await group()).exceptions.map(item => item.action)).toEqual(['skipped', 'skipped'])
  await occurrenceDelete.undo()
  expect(await group()).toEqual(previous)
  const seriesDelete = await applyBulkTaskChange(targets, { kind: 'delete', scope: 'series' }, now)
  expect(await group()).toBeUndefined()
  await seriesDelete.undo()
  expect(await group()).toEqual(previous)
})

it('moves elapsed timed tasks to today as all-day and undoes their reminder changes', async () => {
  vi.setSystemTime(new Date(2026, 10, 21, 8))
  await saveTask({ ...draft(), startDate: '2026-11-21', allDay: false, startTime: '09:00', reminders: [0, 5] }, 0)
  const previous = await group()
  const moved = await applyBulkTaskChange([{ id: previous.task.id }], { kind: 'date', date: today }, now)
  expect(moved.timeRemoved).toBe(1)
  expect((await group()).task).toMatchObject({
    allDay: true, startAt: today, reminders: [], status: 'postponed', originalDate: '2026-11-21', rescheduleCount: 1,
  })
  await moved.undo()
  expect(await group()).toEqual(previous)
})

it('creates, edits, and undoes with new or reordered subtasks', async () => {
  const a = child('First')
  const b = child('Second')
  await saveTask({ ...draft(), subtasks: [a, b] }, 1)
  let saved = await group()
  expect(saved.task.title).toBe('My task')
  expect(taskValue(saved, today).subtasks.map(item => item.title)).toEqual(['First', 'Second'])
  const undo = await saveTask({ ...draft(), title: 'New', subtasks: [b, a] }, 1, saved.task.id)
  saved = await group()
  expect(taskValue(saved, today).subtasks.map(item => item.title)).toEqual(['Second', 'First'])
  const undoRemove = await saveTask({ ...draft(), title: 'New', subtasks: [b] }, 1, saved.task.id)
  expect((await group()).subtasks.find(item => item.id === a.id)?.deletedAt).toBeTruthy()
  await undoRemove()
  await undo()
  expect((await group()).task.title).toBe('My task')
})

it('checks progress and auto-completes and reopens only when enabled', async () => {
  const item = child('First')
  await saveTask({ ...draft(), subtasks: [item] }, 1)
  const { task } = await group()
  await changeCompletion(task.id, undefined, true, item.id)
  expect((await group()).task.status).toBe('todo')
  expect(progress(taskValue(await group(), today).subtasks)).toEqual({ done: 1, total: 1 })
  await saveTask({ ...taskValue(await group(), today), autoCompleteWhenSubtasksDone: true }, 1, task.id)
  expect((await group()).task.status).toBe('done')
  const undo = await changeCompletion(task.id, undefined, false, item.id)
  expect((await group()).task.status).toBe('todo')
  await undo()
  expect((await group()).task.status).toBe('done')
})

it('moves, skips, and completes separate occurrences with independent subtask checks', async () => {
  const item = child('First')
  await saveTask({ ...draft(), repeat: { ...defaultRepeat, mode: 'daily' }, subtasks: [item], autoCompleteWhenSubtasksDone: true }, 1)
  const { task } = await group()
  await changeCompletion(task.id, today, true, item.id)
  await deleteTask(task.id, '2026-11-24')
  await saveTask({ ...draft(), title: 'Moved and renamed', startDate: '2026-11-26', subtasks: [item] }, 1, task.id, '2026-11-25')
  const saved = await group()
  expect(saved.task.status).toBe('todo')
  expect(taskValue(saved, today, today).subtasks[0].done).toBe(true)
  expect(taskValue(saved, today, '2026-11-23').subtasks[0].done).toBe(false)
  expect(smartRows([saved], 'Today', now)).toHaveLength(0)
  expect(smartRows([saved], 'Completed', now).map(row => row.occurrence)).toEqual([today])
  const upcoming = smartRows([saved], 'Upcoming', now)
  expect(upcoming.map(row => row.occurrence)).not.toContain('2026-11-24')
  expect(upcoming.find(row => row.occurrence === '2026-11-25')?.value).toMatchObject({
    title: 'Moved and renamed', startDate: '2026-11-26',
  })
  expect(upcoming.filter(row => row.value.startDate === '2026-11-26')).toHaveLength(2)
})

it('supports smart list date boundaries with one-time and repeating tasks', async () => {
  vi.setSystemTime(new Date(2026, 10, 20, 12))
  await saveTask({ ...draft(), startDate: '2026-11-20', title: 'Repeat', repeat: { ...defaultRepeat, mode: 'daily' } }, 1)
  await saveTask({ ...draft(), startDate: '2026-11-21', title: 'Late' }, 1)
  await saveTask({ ...draft(), startDate: '2026-11-29', title: 'Next week' }, 1)
  await saveTask({ ...draft(), startDate: '2026-11-30', title: 'Outside' }, 1)
  await saveTask({ ...draft(), title: 'Done', status: 'done' }, 1)
  const groups = await readGroups()
  expect(smartRows(groups, 'Today', now).map(row => row.value.title)).toEqual(['Repeat'])
  expect(smartRows(groups, 'Overdue', now).map(row => row.value.title).sort()).toEqual(['Late', 'Repeat', 'Repeat'])
  expect(smartRows(groups, 'Upcoming', now).map(row => row.value.title).sort()).toEqual(['Next week', ...Array(7).fill('Repeat')])
  expect(smartRows(groups, 'Completed', now).map(row => row.value.title)).toEqual(['Done'])
})

it('restores only children deleted with the task, supports undo, and purges after 30 days', async () => {
  const a = child('Keep')
  const b = child('Removed earlier')
  await saveTask({ ...draft(), subtasks: [a, b] }, 1)
  const { task } = await group()
  await saveTask({ ...draft(), subtasks: [a] }, 1, task.id)
  await table('subtasks').update(b.id, { deletedAt: '2026-11-20T01:00:00.000Z' })
  const undo = await deleteTask(task.id)
  expect(await readGroups()).toEqual([])
  expect((await readGroups(true))[0].subtasks.every(item => item.deletedAt)).toBe(true)
  await undo()
  await deleteTask(task.id)
  await restoreTask(task.id)
  expect(taskValue(await group(), today).subtasks.map(item => item.title)).toEqual(['Keep'])
  await expect(permanentlyDeleteTask(task.id)).rejects.toThrow()
  await deleteTask(task.id)
  await table('tasks').update(task.id, { deletedAt: '2026-10-01T00:00:00.000Z' })
  expect(await purgeTasks(new Date('2026-10-31T00:00:00.000Z'))).toBe(0)
  expect(await purgeTasks(new Date('2026-11-01T00:00:00.000Z'))).toBe(1)
  expect(await table('subtasks').count()).toBe(0)
})

it('rejects invalid titles, long fields, dates and times at the service layer', () => {
  for (const data of [
    { title: ' ' }, { title: 'x'.repeat(121) }, { tag: 'x'.repeat(31) },
    { description: 'x'.repeat(2001) }, { startDate: '2026-02-30' },
    { allDay: false, startTime: '15:00', endTime: '14:30' },
  ]) expect(() => saveTask({ ...draft(), ...data }, 1)).toThrow()
})

it('preserves v1 tasks, children, exceptions and Day Themes through subsequent migrations', async () => {
  const name = 'migration-' + crypto.randomUUID()
  const legacy = new Dexie(name)
  legacy.version(1).stores({
    tasks: 'id,startAt,endAt,status,deletedAt', subtasks: 'id,taskId,dueAt,deletedAt',
    taskExceptions: 'id,taskId,date,[taskId+date],deletedAt',
    dayThemes: 'id,weekday,date,deletedAt', accounts: 'id,type,deletedAt', incomes: 'id,expectedDate,status,accountId,deletedAt',
    expenses: 'id,date,status,accountId,deletedAt', budgetHistory: 'id,entityId,changedAt,deletedAt',
    settings: 'id,&key,deletedAt', snapshots: 'id,&day,deletedAt',
  })
  const task = { ...metadata(), ...storedTask(draft(), 1) }
  const subtask = { ...metadata(), taskId: task.id, title: 'Legacy', done: false, order: 0 }
  const exception = { ...metadata(), taskId: task.id, date: today, action: 'moved', movedTo: '2026-11-23', subtaskStates: {} }
  const theme = { ...metadata(), weekday: 1, name: 'Study', color: 'lavender', icon: 'book' }
  await legacy.table('tasks').add(task)
  await legacy.table('subtasks').add(subtask)
  await legacy.table('taskExceptions').add(exception)
  await legacy.table('dayThemes').add(theme)
  legacy.close()
  const upgraded = openDatabase(name)
  try {
    await upgraded.open()
    expect(upgraded.verno).toBe(11)
    expect(await upgraded.table('tasks').get(task.id)).toEqual({ ...task, alertNotify: task.reminders.length > 0 })
    expect(await upgraded.table('subtasks').get(subtask.id)).toEqual(subtask)
    expect(await upgraded.table('taskExceptions').where('movedTo').equals('2026-11-23').first()).toEqual(exception)
    expect(await upgraded.table('dayThemes').get(theme.id)).toEqual(theme)
  } finally {
    await upgraded.delete()
  }
})
