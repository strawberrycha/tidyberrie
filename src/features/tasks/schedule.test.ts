import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { scheduleDates } from './recurrence'
import { deleteSchedule, duplicateSchedule, saveSchedule } from './scheduleService'
import { reminderWindow, notificationId } from '../reminders/window'
import { changeCompletion, changeTaskStatus, rescheduleTask } from './service'
import { readGroups } from './repository'
import { storedTask, taskValue } from './model'
import { table } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import { emptyTask, taskInput } from './input'

const draft = { name: ' Monday ', days: [1], color: 'rose', icon: 'check', paused: false, startDate: null, endDate: null }

it('validates schedule names, days and date ranges', async () => {
  const saved = await saveSchedule(draft)
  expect(saved.name).toBe('Monday')
  await expect(saveSchedule({ ...draft, name: 'monday' })).rejects.toThrow('already uses')
  expect(() => saveSchedule({ ...draft, days: [] })).toThrow('Choose at least one day')
  expect(() => saveSchedule({ ...draft, startDate: '2028-03-01', endDate: '2028-02-29' })).toThrow('End date')
  expect(taskInput.safeParse({ ...emptyTask('2028-02-29'), title: 'Wake', scheduleId: saved.id }).success).toBe(false)
})

it('queues fourteen days of opted-in notifications with stable distinct IDs', async () => {
  const schedule = await saveSchedule({ ...draft, name: 'Daily', days: [0, 1, 2, 3, 4, 5, 6] })
  const task = { ...metadata(), ...storedTask({ ...emptyTask('2028-02-27'), title: 'Wake', scheduleId: schedule.id,
    allDay: false, startTime: '07:00', alertNotify: true }, 0) }
  const groups = [{ task, schedule, subtasks: [], exceptions: [] }]
  const from = +new Date('2028-02-27T08:00')
  const through = +new Date('2028-03-12T08:00')
  const result = reminderWindow(groups, from, through)
  expect(result).toHaveLength(14)
  const ids = result.map(item => notificationId(item.key))
  expect(new Set(ids).size).toBe(14)
  expect(ids.every(id => id > 0 && id <= 2147483647)).toBe(true)
  expect(reminderWindow(groups, from, through, 3)).toEqual(result.slice(0, 3))
  expect(reminderWindow([{ ...groups[0], schedule: { ...schedule, paused: true } }], from, through)).toEqual([])
  expect(reminderWindow([{ ...groups[0], task: { ...task, alertNotify: false } }], from, through)).toEqual([])
})

it('duplicates task definitions and restores a schedule with its linked tasks', async () => {
  const source = await saveSchedule({ ...draft, name: 'Source' })
  const task = { ...metadata(), ...storedTask({ ...emptyTask('2028-02-28'), title: 'Wake', scheduleId: source.id,
    allDay: false, startTime: '07:00', alertNotify: true }, 0) }
  await table('tasks').add(task)
  await table('subtasks').add({ ...metadata(), taskId: task.id, title: 'Get up', order: 0, done: true })
  const { copy } = await duplicateSchedule(source.id, 'Tuesday', [2])
  const copied = await table('tasks').where('scheduleId').equals(copy.id).first()
  expect(copied).toMatchObject({ title: 'Wake', alertNotify: true })
  expect(await table('subtasks').where('taskId').equals(copied!.id).first()).toMatchObject({ done: false })
  const undo = await deleteSchedule(source.id)
  expect((await table('tasks').get(task.id))?.deletedAt).toBeTruthy()
  await undo()
  expect((await table('tasks').get(task.id))?.deletedAt).toBeNull()
})

it('changes individual scheduled occurrences and preserves their time when rescheduling', async () => {
  const schedule = await saveSchedule({ ...draft, name: 'Exceptions', days: [1, 2, 3] })
  const date = '2028-02-28'
  const task = { ...metadata(), ...storedTask({ ...emptyTask(date), title: 'Scheduled task', scheduleId: schedule.id,
    allDay: false, startTime: '07:00', alertNotify: true }, 0) }
  await table('tasks').add(task)
  const child = { ...metadata(), taskId: task.id, title: 'Part', order: 0, done: false }
  await table('subtasks').add(child)
  await changeCompletion(task.id, date, true, child.id)
  await changeTaskStatus(task.id, '2028-02-29', 'skipped')
  await expect(rescheduleTask(task.id, '2028-03-01', date, new Date(date + 'T09:00'))).rejects.toThrow('That time has already passed')
  await rescheduleTask(task.id, '2028-03-01', '2028-03-02', new Date(date + 'T09:00'))
  const group = (await readGroups()).find(item => item.task.id === task.id)!
  expect(taskValue(group, date, date).subtasks[0].done).toBe(true)
  expect(taskValue(group, date, '2028-02-29')).toMatchObject({ status: 'skipped', subtasks: [{ done: false }] })
  expect(taskValue(group, date, '2028-03-01')).toMatchObject({ status: 'postponed', startDate: '2028-03-02', startTime: '07:00' })
  const upcoming = reminderWindow([group], +new Date('2028-02-29T00:00'), +new Date('2028-03-03T00:00'))
  expect(upcoming.map(item => item.at)).toEqual([+new Date('2028-03-02T07:00')])
})

it('expands only enabled days inside inclusive local bounds', () => {
  const schedule = { ...draft, days: [1, 2, 3, 4, 5], startDate: '2028-02-29', endDate: '2028-03-02', deletedAt: null }
  expect(scheduleDates(schedule, '2028-02-27', '2028-03-06')).toEqual(['2028-02-29', '2028-03-01', '2028-03-02'])
  expect(scheduleDates({ ...schedule, paused: true }, '2028-02-27', '2028-03-06')).toEqual([])
  expect(scheduleDates({ ...schedule, startDate: null, endDate: null, days: [0, 6] }, '2028-12-30', '2029-01-01'))
    .toEqual(['2028-12-30', '2028-12-31'])
})
