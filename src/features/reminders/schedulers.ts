import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { LocalNotificationsPlugin } from '@capacitor/local-notifications'
import { minute, notificationId, testKey } from './window'
import type { Reminder } from './window'
import { openDeviceSettings } from './deviceSettings'

export type Access = 'checking' | 'granted' | 'denied' | 'unavailable' | 'error' | 'unknown'

export async function deadline<T>(work: Promise<T>, timeout: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([work, new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => {
        try { resolve(timeout()) } catch (error) { reject(error) }
      }, 3000)
    })])
  } finally {
    clearTimeout(timer)
  }
}

const bridgeTimeout = (): never => { throw new Error('Android did not respond in time.') }

export async function checkAccess(work: () => Promise<Access>): Promise<Access> {
  try { return await deadline(work(), () => 'unknown') }
  catch { return 'error' }
}
export type ReminderStatus = { notifications: Access; exact: Access; canPrompt?: boolean; message?: string }
export type DeliveryClaims = { claim: (key: string, at: number) => Promise<boolean>; release: (key: string, at: number) => Promise<void> }
export interface NotificationScheduler {
  platform: 'web' | 'android'
  status(): Promise<ReminderStatus>
  requestNotifications(): Promise<void>
  requestExact(): Promise<void>
  openSystemSettings(): Promise<void>
  initialize?(): Promise<void>
  pending?(): Promise<{ title: string; at: number }[]>
  sync(rows: Reminder[], now: number, status?: ReminderStatus, force?: boolean): Promise<void>
}

const channelId = 'tidyberrie-reminders'
const signature = (item: Reminder) => JSON.stringify([item.key, item.at, item.title])

export class WebNotificationScheduler implements NotificationScheduler {
  readonly platform = 'web'
  constructor(private claims: DeliveryClaims) {}

  async status(): Promise<ReminderStatus> {
    const permission = typeof Notification === 'undefined' ? 'unavailable' : Notification.permission
    return { notifications: permission === 'default' ? 'denied' : permission, exact: 'unavailable', canPrompt: permission === 'default' }
  }

  async requestNotifications() {
    if (typeof Notification !== 'undefined') await Notification.requestPermission()
  }

  async requestExact() {}
  async openSystemSettings() {}

  async sync(rows: Reminder[], now: number) {
    if ((await this.status()).notifications !== 'granted') return
    for (const row of rows) {
      if (row.at > now || row.at < now - minute || !await this.claims.claim(row.key, row.at)) continue
      const options = { body: row.title, tag: row.key, icon: '/icon-192.png' }
      try {
        new Notification('Tidyberrie reminder', options)
      } catch {
        await this.claims.release(row.key, row.at)
      }
    }
  }
}

export class AndroidLocalNotificationScheduler implements NotificationScheduler {
  readonly platform = 'android'
  private channelCreated = false
  constructor(private plugin: LocalNotificationsPlugin = LocalNotifications, private available = true, private clock = Date.now) {}

  async status(): Promise<ReminderStatus> {
    if (!this.available) return { notifications: 'unavailable', exact: 'unavailable', message: 'Local Notifications plugin is missing.' }
    let canPrompt = false
    const [notifications, exact] = await Promise.all([
      checkAccess(async () => {
        const { display } = await this.plugin.checkPermissions()
        canPrompt = display === 'prompt' || display === 'prompt-with-rationale'
        if (!canPrompt && display !== 'granted' && display !== 'denied') return 'unknown'
        if (display !== 'granted') return 'denied'
        return (await this.plugin.areEnabled()).value ? 'granted' : 'denied'
      }),
      checkAccess(async () => {
        const { exact_alarm: access } = await this.plugin.checkExactNotificationSetting()
        return access === 'granted' ? 'granted' : access ? 'denied' : 'unknown'
      }),
    ])
    return { notifications, exact, canPrompt, message: [notifications, exact].includes('error') ? 'Android could not check reminder permissions.' : undefined }
  }

  async requestNotifications() { await this.plugin.requestPermissions() }
  async requestExact() { await this.plugin.changeExactNotificationSetting() }
  async openSystemSettings() { await openDeviceSettings('notifications') }

  async initialize() {
    if (!this.available || this.channelCreated) return
    try {
      await deadline(this.plugin.createChannel({ id: channelId, name: 'Task reminders', importance: 4, visibility: 0, vibration: true }), bridgeTimeout)
    } catch (error) {
      // Notification channels were introduced in Android 8.
      if ((error as { code?: string })?.code !== 'UNAVAILABLE') throw error
    }
    this.channelCreated = true
  }

  async pending() {
    const { notifications } = await deadline(this.plugin.getPending(), bridgeTimeout)
    return notifications.filter(item => item.extra?.namespace === channelId).map(item => ({
      title: item.body ?? '', at: Number(item.extra.at ?? JSON.parse(item.extra.signature)[1]),
    })).filter(item => Number.isFinite(item.at) && item.at > this.clock()).sort((a, b) => a.at - b.at)
  }

  async sync(rows: Reminder[], now: number, permission?: ReminderStatus, force = false) {
    const status = permission ?? await this.status()
    if (!['granted', 'denied'].includes(status.notifications)) throw new Error('Notification permission could not be verified.')
    if (status.notifications === 'granted' && !['granted', 'denied'].includes(status.exact)) {
      throw new Error('Exact-alarm access could not be verified.')
    }
    const { notifications: pending } = await deadline(this.plugin.getPending(), bridgeTimeout)
    const owned = pending.filter(item => item.extra?.namespace === channelId)
    const desired = new Map<number, Reminder>()
    const existingIds = new Map(owned.map(item => [item.extra.key ?? JSON.parse(item.extra.signature)[0], item.id]))
    const reserved = new Set(pending.map(item => item.id))
    for (const row of [...rows].sort((a, b) => a.key.localeCompare(b.key))) {
      const existing = existingIds.get(row.key)
      let id = existing ?? notificationId(row.key)
      while (desired.has(id) || (existing === undefined && reserved.has(id))) id = id === 2147483646 ? 1 : id + 1
      desired.set(id, row)
    }
    const accessible = status.notifications === 'granted'
    const exact = status.exact === 'granted'
    const keep = new Set<number>()
    const obsolete = owned.filter(item => {
      const next = desired.get(item.id)
      if (!accessible || !next || (force && next.at > now) ||
        item.extra.signature !== signature(next) || item.extra.exact !== exact) return true
      keep.add(item.id)
      return false
    })
    if (obsolete.length) await deadline(this.plugin.cancel({ notifications: obsolete.map(({ id }) => ({ id })) }), bridgeTimeout)
    if (!accessible) return
    const future = [...desired].flatMap(([id, row]) => keep.has(id) || row.at <= now ? [] : [{
      id, title: row.key === testKey ? 'Tidyberrie test reminder' : 'Tidyberrie reminder',
      body: row.title, channelId, schedule: { at: new Date(row.at), allowWhileIdle: true },
      isExactNotification: exact,
      extra: { namespace: channelId, signature: signature(row), key: row.key, at: row.at, exact },
    }])
    if (!future.length) return
    await this.initialize()
    const notifications = future.filter(item => +item.schedule.at > this.clock())
    if (notifications.length) await deadline(this.plugin.schedule({ notifications }), bridgeTimeout)
  }
}

export function selectScheduler(claims: DeliveryClaims, platform = Capacitor.getPlatform()): NotificationScheduler {
  return platform === 'android' ? new AndroidLocalNotificationScheduler(LocalNotifications, !Capacitor.isNativePlatform() || Capacitor.isPluginAvailable('LocalNotifications')) : new WebNotificationScheduler(claims)
}
