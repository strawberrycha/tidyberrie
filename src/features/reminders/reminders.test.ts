import 'fake-indexeddb/auto'
import { expect, it, vi } from 'vitest'
import type { LocalNotificationSchema, LocalNotificationsPlugin } from '@capacitor/local-notifications'
import { emptyTask, newSubtask } from '../tasks/input'
import type { TaskInput } from '../tasks/input'
import { storedTask } from '../tasks/model'
import type { TaskGroup } from '../tasks/model'
import { defaultRepeat } from '../tasks/recurrence'
import { changeCompletion, deleteTask, restoreTask, saveTask } from '../tasks/service'
import { readGroups } from '../tasks/repository'
import { addDays, localDate } from '../tasks/recurrence'
import { moduleReminders, startReminders } from './service'
import { openDeviceSettings } from './deviceSettings'
import { AndroidLocalNotificationScheduler, checkAccess, selectScheduler } from './schedulers'
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
    getPending: async () => ({ notifications: [...pending.values()] }), createChannel: vi.fn(), schedule, cancel,
  } as unknown as LocalNotificationsPlugin
  const scheduler = new AndroidLocalNotificationScheduler(mock, true, () => 10000)
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
  await scheduler.sync([{ ...original, at: 9999 }], 10000)
  expect(pending.size).toBe(0)
  expect(Number.isInteger(id) && id > 0 && id <= 2147483647).toBe(true)

  const first = { ...original, key: 'task/1imv84g/0' }
  const second = { ...original, key: 'task/1okk67u/0' }
  expect(notificationId(first.key)).toBe(notificationId(second.key))
  await scheduler.sync([first, second], 10000)
  expect(pending.size).toBe(2)
  const secondId = [...pending.values()].find(item => item.extra?.key === second.key)?.id
  await scheduler.sync([second], 10000)
  expect([...pending.keys()]).toEqual([secondId])
})

it('checks notification and exact-alarm access independently and requests access only on demand', async () => {
  const checkPermissions = vi.fn().mockResolvedValue({ display: 'prompt' })
  const checkExactNotificationSetting = vi.fn().mockResolvedValue({ exact_alarm: 'denied' })
  const requestPermissions = vi.fn()
  const changeExactNotificationSetting = vi.fn()
  const plugin = { checkPermissions, checkExactNotificationSetting, requestPermissions, changeExactNotificationSetting,
    areEnabled: vi.fn().mockResolvedValue({ value: true }) } as unknown as LocalNotificationsPlugin
  const scheduler = new AndroidLocalNotificationScheduler(plugin)
  expect(await scheduler.status()).toMatchObject({ notifications: 'denied', exact: 'denied', canPrompt: true })
  expect(requestPermissions).not.toHaveBeenCalled()
  await scheduler.requestNotifications()
  expect(requestPermissions).toHaveBeenCalledOnce()
  checkPermissions.mockResolvedValue({ display: 'denied' })
  expect(await scheduler.status()).toMatchObject({ notifications: 'denied', canPrompt: false })
  checkPermissions.mockResolvedValue({ display: 'granted' })
  expect(await scheduler.status()).toMatchObject({ notifications: 'granted', exact: 'denied' })
  await scheduler.requestExact()
  expect(changeExactNotificationSetting).toHaveBeenCalledOnce()
})

it('reconciles even when there is no Budget subscription', async () => {
  const results = vi.fn()
  const sync = vi.fn<(rows: { title: string }[]) => Promise<void>>().mockResolvedValue(undefined)
  const stop = startReminders(results, {
    platform: 'android',
    status: async () => ({ notifications: 'granted', exact: 'granted' }),
    requestNotifications: vi.fn(), requestExact: vi.fn(), openSystemSettings: vi.fn(), sync,
  })
  const queued = async (titles: string[]) => vi.waitFor(() => expect(sync.mock.lastCall?.[0].map(row => row.title)).toEqual(titles))
  const draft = { ...emptyTask(addDays(localDate(), 1)), title: 'Original', reminders: [0] as [0] }
  try {
    await queued([])
    await saveTask(draft, 0)
    await queued(['Original'])
    const [group] = await readGroups()
    const { id } = group.task
    await saveTask({ ...draft, title: 'Edited' }, 0, id)
    await queued(['Edited'])
    await changeCompletion(id, undefined, true)
    await queued([])
    await changeCompletion(id, undefined, false)
    await queued(['Edited'])
    await deleteTask(id)
    await queued([])
    await restoreTask(id)
    await queued(['Edited'])
  } finally {
    stop()
  }
})

it('leaves checking after three seconds and supports retry after timeout or error', async () => {
  vi.useFakeTimers()
  try {
    const pending = checkAccess(() => new Promise(() => {}))
    await vi.advanceTimersByTimeAsync(3000)
    await expect(pending).resolves.toBe('unknown')
    await expect(checkAccess(async () => { throw new Error('Bridge failure') })).resolves.toBe('error')
    await expect(checkAccess(async () => 'granted')).resolves.toBe('granted')
  } finally {
    vi.useRealTimers()
  }
})

it('opens app details when a requested settings screen fails', async () => {
  const bridge = { open: vi.fn().mockRejectedValueOnce(new Error('Screen unavailable')).mockResolvedValueOnce(undefined), info: vi.fn() }
  await openDeviceSettings('autostart', bridge)
  expect(bridge.open.mock.calls).toEqual([[{ screen: 'autostart' }], [{ screen: 'app' }]])
})

it('gates the reminder queue by module while leaving task reminders and stored bills intact', () => {
  const bill = { ...stamp(), date: '2026-12-01', amount: 200, category: 'Power', recurrenceRule: null,
    accountId: crypto.randomUUID(), status: 'planned' as const, billReminder: 0 as const }
  const budget = { accounts: [], incomes: [], expenses: [bill], transfers: [], debts: [], categoryBudgets: [], goals: [], preferences: undefined }
  const start = at('2026-12-01T00:00')
  const finish = at('2026-12-02T00:00')
  const groups = [task({ reminders: [0] })]
  expect(moduleReminders({ tasks: true, budget: false }, groups, budget, start, finish).map(item => item.title)).toEqual(['Read'])
  expect(moduleReminders({ tasks: true, budget: true }, groups, budget, start, finish).map(item => item.title)).toEqual(['Read', 'Bill due · Power'])
  expect(budget.expenses).toEqual([bill])
})
