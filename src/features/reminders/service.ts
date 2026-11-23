import { features } from '../../app/features'
import { z } from '../../shared/db/strictValidation'
import { changeCompletion, watchTasks } from '../tasks/service'
import type { TaskGroup } from '../tasks/model'
import { watchBudget } from '../budget/service'
import { budgetDueWindow } from '../budget/due'
import { localDate } from '../tasks/recurrence'
import * as repository from './repository'
import type { DeviceRecord } from './repository'
import { deadline, selectScheduler } from './schedulers'
import type { NotificationScheduler, ReminderStatus } from './schedulers'
import { applyDispositions, defaultLimit, minute, queueLimits, reminderWindow, snoozeTime, sorted, testKey } from './window'
import type { Reminder } from './window'

const day = 1440 * minute
const retention = 14 * day
const limitSchema = z.literal(queueLimits)
const reminderSchema = z.strictObject({
  key: z.string().min(1).max(120), title: z.string().max(500),
  at: z.int().positive(), sourceAt: z.int().positive(),
})
const duration = z.enum(['10-minutes', '1-hour', 'tomorrow'])

const scheduler = selectScheduler({ claim: repository.claimWebDelivery, release: repository.releaseWebDelivery })
export const reminderPlatform = scheduler.platform
export const requestNotifications = () => scheduler.requestNotifications()
export const requestExact = () => scheduler.requestExact()
export const openSystemSettings = () => scheduler.openSystemSettings()
export const setReminderLimit = (value: number) => repository.saveRecord('limit', limitSchema.parse(value), 0)
export function scheduleTest(seconds = 60) {
  const at = Date.now() + z.literal([10, 60]).parse(seconds) * 1000
  return repository.saveRecord('test', at, at)
}
export function snoozeReminder(input: Reminder, choice: string) {
  const reminder = reminderSchema.parse(input)
  return repository.saveRecord('state:' + reminder.key, snoozeTime(new Date(), duration.parse(choice)), reminder.sourceAt)
}
export function dismissReminder(input: Reminder) {
  const reminder = reminderSchema.parse(input)
  return repository.saveRecord('state:' + reminder.key, 0, reminder.sourceAt, true)
}

export function markReminderDone(input: Reminder) {
  const { key } = reminderSchema.parse(input)
  const parts = key.split('/')
  const taskId = z.uuid().safeParse(parts[0])
  const occurrence = z.iso.date().safeParse(parts[1])
  const subject = z.union([z.literal('task'), z.uuid()]).safeParse(parts[2])
  if (parts.length !== 4 || !taskId.success || !occurrence.success || !subject.success) return
  return changeCompletion(taskId.data, undefined, true, subject.data === 'task' ? undefined : subject.data, occurrence.data)
}

export type ReminderState = {
  status?: ReminderStatus; due: Reminder[]; limit: number; testAt?: number; error?: boolean
  pending?: { title: string; at: number }[]
  lastRun?: number; result?: string; lastError?: string; cappedThrough?: number
}
const timeout = (): never => { throw new Error('Android did not respond in time.') }

type BudgetSnapshot = Parameters<Parameters<typeof watchBudget>[0]>[0]

export function moduleReminders(flags: Pick<typeof features, 'tasks' | 'budget'>, groups: TaskGroup[], budget: BudgetSnapshot | undefined, from: number, through: number) {
  const rows = flags.tasks ? reminderWindow(groups, from, through, Infinity) : []
  if (flags.budget && budget) rows.push(...budgetDueWindow(budget, from, through))
  return rows
}

function stateFor(groups: TaskGroup[], records: DeviceRecord[], budget: BudgetSnapshot | undefined, now: number) {
  const limit = limitSchema.safeParse(records.find(record => record.key === 'limit')?.value).data ?? defaultLimit
  const test = records.find(record => record.key === 'test')
  const reminders = moduleReminders(features, groups, budget, now - retention - day, now + retention)
  if (test && test.value >= now - retention) {
    reminders.push({ key: testKey, title: 'This is your Tidyberrie test reminder.', at: test.value, sourceAt: test.sourceAt })
  }
  const adjusted = sorted(applyDispositions(reminders, repository.dispositions(records)))
  const due = adjusted.filter(item => item.at >= now - retention && item.at <= now).reverse()
  const future = adjusted.filter(item => item.at > now && item.at <= now + retention)
  const upcoming = future.slice(0, limit)
  const cappedThrough = future.length > limit ? upcoming.at(-1)?.at : undefined
  const testReminder = adjusted.find(item => item.key === testKey && item.at > now)
  if (testReminder && !upcoming.includes(testReminder)) upcoming.splice(limit - 1, 1, testReminder)
  return { due, upcoming, limit, cappedThrough, testAt: testReminder?.at }
}

let scheduleWork = Promise.resolve()
export function startReminders(publish: (state: ReminderState) => void, runtime: NotificationScheduler = scheduler) {
  let groups: TaskGroup[] | undefined
  let records: DeviceRecord[] | undefined
  let budget: BudgetSnapshot | undefined
  let stopped = false
  let queued = false
  let forcePending = false
  let lastPrune = ''
  let previous: ReminderState = { due: [], limit: defaultLimit }
  const update = (next: Partial<ReminderState>) => {
    if (!stopped) { previous = { ...previous, ...next }; publish(previous) }
  }
  const reportError = () => {
    update({ error: true, lastError: 'Could not read local reminder data.' })
  }

  function refresh() {
    if (!groups || !records || (features.budget && !budget) || stopped || queued) return
    queued = true
    scheduleWork = scheduleWork.then(async () => {
      queued = false
      if (stopped || !groups || !records || (features.budget && !budget)) return
      const force = forcePending
      forcePending = false
      const now = Date.now()
      const { due, upcoming, limit, cappedThrough, testAt } = stateFor(groups, records, budget, now)
      update({ due, limit, testAt, cappedThrough: undefined, lastRun: now })
      try {
        const status = await runtime.status()
        if (stopped) return
        update({ status })
        const recent = runtime.platform === 'web' ? due.filter(item => item.at >= now - minute) : []
        if (runtime.initialize) await deadline(runtime.initialize(), timeout)
        if (stopped) return
        await runtime.sync([...upcoming, ...recent], now, status, force)
        const pending = runtime.pending ? await deadline(runtime.pending(), timeout) : undefined
        update({ pending, cappedThrough: status.notifications === 'granted' ? cappedThrough : undefined, result: status.notifications === 'granted' ? 'Reconciled' : 'Notifications off', error: false, lastError: undefined })
        const date = localDate(new Date(now))
        if (lastPrune !== date) {
          lastPrune = date
          await repository.pruneRecords(now - retention - day)
        }
      } catch {
        update({ error: true, result: 'Failed', lastError: 'Android reminder reconciliation failed or timed out.' })
      }
    }).catch(reportError)
  }

  function checkStatus() {
    update({ status: { notifications: 'checking', exact: 'checking' } })
    void runtime.status().then(status => update({ status }), () => update({
      status: { notifications: 'error', exact: 'error', message: 'Could not check reminder permissions.' },
    }))
  }
  function retry() {
    if (!groups || !records || (features.budget && !budget)) checkStatus()
    else refresh()
  }
  function forceRefresh() {
    forcePending = true
    retry()
  }
  checkStatus()
  const stopTasks = features.tasks ? watchTasks(false, values => { groups = values; refresh() }, reportError) : undefined
  if (!features.tasks) groups = []
  const stopRecords = repository.observeRecords(values => { records = values; refresh() }, reportError)
  const stopBudget = features.budget ? watchBudget(value => { budget = value; refresh() }, reportError) : undefined
  const interval = window.setInterval(refresh, 15_000)
  let midnight: number
  function atMidnight() {
    const next = new Date()
    next.setHours(24, 0, 0, 0)
    midnight = window.setTimeout(() => { refresh(); atMidnight() }, +next - Date.now())
  }
  atMidnight()
  document.addEventListener('visibilitychange', refresh)
  window.addEventListener('focus', refresh)
  window.addEventListener('tidyberrie-reminder-refresh', retry)
  window.addEventListener('tidyberrie-reminder-reschedule', forceRefresh)
  return () => {
    stopped = true
    stopTasks?.()
    stopRecords()
    stopBudget?.()
    window.clearInterval(interval)
    window.clearTimeout(midnight)
    document.removeEventListener('visibilitychange', refresh)
    window.removeEventListener('focus', refresh)
    window.removeEventListener('tidyberrie-reminder-refresh', retry)
    window.removeEventListener('tidyberrie-reminder-reschedule', forceRefresh)
  }
}
