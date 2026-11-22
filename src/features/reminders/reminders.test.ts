import { expect, it, vi } from 'vitest'
import type { LocalNotificationSchema, LocalNotificationsPlugin } from '@capacitor/local-notifications'
import { emptyTask, newSubtask } from '../tasks/input'
import type { TaskInput } from '../tasks/input'
import { storedTask } from '../tasks/model'
import type { TaskGroup } from '../tasks/model'
import { defaultRepeat } from '../tasks/recurrence'
import { AndroidLocalNotificationScheduler, selectScheduler } from './schedulers'
import { applyDispositions, minute, notificationId, reminderWindow, snoozeTime } from './window'

function stamp() {
  const timestamp = '2026-11-22T00:00:00Z'
  return { id: crypto.randomUUID(), createdAt: timestamp, updatedAt: timestamp, deletedAt: null }
}

function task(input: Partial<TaskInput> = {}): TaskGroup {
  return {
    task: { ...stamp(), ...storedTask({
      ...emptyTask('2026-12-01'), title: 'Read', startTime: '00:10', allDay: false, reminders: [0, 15, 1440], ...input,
    }, 1) },
    subtasks: [], exceptions: [],
  }
}

const at = (value: string) => +new Date(value)

it('clips and caps the upcoming window and offsets that cross midnight or a month boundary', () => {
  const group = task()
  const start = at('2026-11-30T00:00')
  const finish = at('2026-12-14T00:00')
  expect(reminderWindow([group], start, finish).map(item => item.at)).toEqual([
    at('2026-11-30T00:10'), at('2026-11-30T23:55'), at('2026-12-01T00:10'),
  ])
  expect(reminderWindow([group], start, finish, 1)).toHaveLength(1)
  expect(reminderWindow([group], at('2026-11-30T23:55'), at('2026-11-30T23:55'))).toHaveLength(1)
  expect(reminderWindow([task({ startDate: '2026-12-25' })], start, finish)).toHaveLength(0)
})

it('uses occurrence exceptions, cancels deleted and completed tasks, and skips checked subtasks', () => {
  const daily = task({ repeat: { ...defaultRepeat, mode: 'daily' }, reminders: [0] })
  daily.exceptions = [
    { ...stamp(), taskId: daily.task.id, date: '2026-12-02', action: 'skipped', movedTo: null, subtaskStates: {} },
    { ...stamp(), taskId: daily.task.id, date: '2026-12-03', action: 'completed', movedTo: null, subtaskStates: {} },
    { ...stamp(), taskId: daily.task.id, date: '2026-12-04', action: 'moved', movedTo: '2026-12-05T08:00:00+08:00', subtaskStates: {} },
  ]
  const deleted = task()
  const once = task({ reminders: [] })
  const child = newSubtask()
  once.subtasks.push({
    ...stamp(), id: child.id, taskId: once.task.id, title: 'Chapter', done: false, order: 0,
    dueAt: '2026-12-01T16:30:00+08:00', reminder: 5,
  })
  deleted.task.deletedAt = '2026-11-30T10:00:00Z'
  const prepare = () => reminderWindow([daily, deleted, once, task({ status: 'done' })], at('2026-12-01T00:00'), at('2026-12-05T23:59'))
  const result = prepare()
  expect(result.map(item => item.at)).toEqual([
    at('2026-12-01T00:10'), at('2026-12-01T16:25'), at('2026-12-05T00:10'), at('2026-12-05T08:00'),
  ])
  expect(result.at(-1)?.key).toContain('/2026-12-04/')
  once.subtasks[0].done = true
  expect(prepare().every(item => !item.key.includes(child.id))).toBe(true)
})

it('snoozes at a stable identity and invalidates stale state when the source time changes', () => {
  const now = new Date(2026, 11, 31, 23, 50)
  expect(snoozeTime(now, '10-minutes')).toBe(+now + 10 * minute)
  expect(snoozeTime(now, '1-hour')).toBe(+now + 60 * minute)
  expect(snoozeTime(now, 'tomorrow')).toBe(+new Date(2027, 0, 1, 23, 50))
  const reminder = { key: 'task/date/task/5', at: +now, sourceAt: +now, title: 'Read' }
  const states = new Map([[reminder.key, { sourceAt: +now, snoozeAt: +now + 10 * minute }]])
  const [snoozed] = applyDispositions([reminder], states)
  expect(snoozed.at).toBe(+now + 10 * minute)
  expect(notificationId(snoozed.key)).toBe(notificationId(reminder.key))
  const edited = { ...reminder, sourceAt: +now + 20 * minute, at: +now + 20 * minute }
  expect(applyDispositions([edited], states)).toEqual([edited])
})

it('selects the scheduler without requesting permissions and reconciles Android alarms idempotently', async () => {
  const claims = { claim: vi.fn(), release: vi.fn() }
  expect(selectScheduler(claims, 'android').platform).toBe('android')
  expect(selectScheduler(claims, 'web').platform).toBe('web')
  const pending = new Map<number, LocalNotificationSchema>()
  const schedule = vi.fn(async ({ notifications }: { notifications: LocalNotificationSchema[] }) => {
    for (const item of notifications) pending.set(item.id, item)
  })
  const cancel = vi.fn(async ({ notifications }: { notifications: { id: number }[] }) => {
    for (const item of notifications) pending.delete(item.id)
  })
  const exact = vi.fn().mockResolvedValue({ exact_alarm: 'granted' })
  const request = vi.fn()
  const mock = {
    checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }), areEnabled: vi.fn().mockResolvedValue({ value: true }),
    checkExactNotificationSetting: exact, requestPermissions: request,
    getAll: async () => ({ notifications: [...pending.values()] }), createChannel: vi.fn(), schedule, cancel,
  } as unknown as LocalNotificationsPlugin
  const scheduler = new AndroidLocalNotificationScheduler(mock)
  const original = { key: 'task/date/task/5', title: 'Read', at: 10100, sourceAt: 10100 }
  await scheduler.sync([original], 10000)
  await scheduler.sync([original], 10000)
  expect(schedule).toHaveBeenCalledTimes(1)
  const id = notificationId(original.key)
  expect(pending.get(id)?.schedule?.at).toEqual(new Date(10100))
  await scheduler.sync([{ ...original, at: 10200, sourceAt: 10200 }], 10000)
  expect(cancel).toHaveBeenCalledWith({ notifications: [{ id }] })
  expect(pending.get(id)?.schedule?.at).toEqual(new Date(10200))
  exact.mockResolvedValue({ exact_alarm: 'denied' })
  await scheduler.sync([original], 10000)
  expect(pending.get(id)?.isExactNotification).toBe(false)
  await scheduler.sync([], 10000)
  expect(pending.size).toBe(0)
  expect(request).not.toHaveBeenCalled()
})
