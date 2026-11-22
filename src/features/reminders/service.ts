import { z } from 'zod'
import { watchTasks } from '../tasks/service'
import type { TaskGroup } from '../tasks/model'
import { watchBudget } from '../budget/service'
import { budgetDueWindow } from '../budget/due'
import { localDate } from '../tasks/recurrence'
import * as repository from './repository'
import type { DeviceRecord } from './repository'
import { selectScheduler } from './schedulers'
import type { ReminderStatus } from './schedulers'
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
export function scheduleTest() {
  const at = Date.now() + minute
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

export type ReminderState = { status?: ReminderStatus; due: Reminder[]; limit: number; testAt?: number; error?: boolean }

type BudgetSnapshot = Parameters<Parameters<typeof watchBudget>[0]>[0]

function stateFor(groups: TaskGroup[], records: DeviceRecord[], budget: BudgetSnapshot, now: number) {
  const limit = limitSchema.safeParse(records.find(record => record.key === 'limit')?.value).data ?? defaultLimit
  const test = records.find(record => record.key === 'test')
  const reminders = reminderWindow(groups, now - retention - day, now + retention, Infinity)
  reminders.push(...budgetDueWindow(budget, now - retention - day, now + retention))
  if (test && test.value >= now - retention) {
    reminders.push({ key: testKey, title: 'This is your Tidyberrie test reminder.', at: test.value, sourceAt: test.sourceAt })
  }
  const adjusted = sorted(applyDispositions(reminders, repository.dispositions(records)))
  const due = adjusted.filter(item => item.at >= now - retention && item.at <= now).reverse()
  const upcoming = adjusted.filter(item => item.at > now).slice(0, limit)
  const testReminder = adjusted.find(item => item.key === testKey && item.at > now)
  if (testReminder && !upcoming.includes(testReminder)) upcoming.splice(limit - 1, 1, testReminder)
  return { due, upcoming, limit, testAt: testReminder?.at }
}

let scheduleWork = Promise.resolve()
export function startReminders(publish: (state: ReminderState) => void) {
  let groups: TaskGroup[] | undefined
  let records: DeviceRecord[] | undefined
  let budget: BudgetSnapshot | undefined
  let stopped = false
  let queued = false
  let lastPrune = ''
  const reportError = () => {
    if (!stopped) publish({ due: [], limit: defaultLimit, error: true })
  }

  function refresh() {
    if (!groups || !records || !budget || stopped || queued) return
    queued = true
    scheduleWork = scheduleWork.then(async () => {
      queued = false
      if (stopped || !groups || !records || !budget) return
      const now = Date.now()
      const { due, upcoming, limit, testAt } = stateFor(groups, records, budget, now)
      const fallback = { due, limit, testAt }
      let status: ReminderStatus | undefined
      try {
        status = await scheduler.status()
        if (stopped) return
        publish({ ...fallback, status })
        const recent = due.filter(item => item.at >= now - (scheduler.platform === 'android' ? day : minute))
        await scheduler.sync([...upcoming, ...recent], now)
        const date = localDate(new Date(now))
        if (lastPrune !== date) {
          lastPrune = date
          await repository.pruneRecords(now - retention - day)
        }
      } catch {
        if (!stopped) publish({ ...fallback, status, error: true })
      }
    }).catch(reportError)
  }

  const stopTasks = watchTasks(false, values => { groups = values; refresh() }, reportError)
  const stopRecords = repository.observeRecords(values => { records = values; refresh() }, reportError)
  const stopBudget = watchBudget(value => { budget = value; refresh() }, reportError)
  const interval = window.setInterval(refresh, 15_000)
  document.addEventListener('visibilitychange', refresh)
  window.addEventListener('focus', refresh)
  window.addEventListener('tidyberrie-reminder-refresh', refresh)
  return () => {
    stopped = true
    stopTasks()
    stopRecords()
    stopBudget()
    window.clearInterval(interval)
    document.removeEventListener('visibilitychange', refresh)
    window.removeEventListener('focus', refresh)
    window.removeEventListener('tidyberrie-reminder-refresh', refresh)
  }
}
