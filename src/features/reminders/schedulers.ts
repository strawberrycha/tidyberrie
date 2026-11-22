import { Capacitor, registerPlugin } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { LocalNotificationsPlugin } from '@capacitor/local-notifications'
import { minute, notificationId, testKey } from './window'
import type { Reminder } from './window'

type Access = 'granted' | 'denied' | 'prompt' | 'unsupported'
export type ReminderStatus = { notifications: Access; exact: Access }
export type DeliveryClaims = { claim: (key: string, at: number) => Promise<boolean>; release: (key: string, at: number) => Promise<void> }
export interface NotificationScheduler {
  platform: 'web' | 'android'
  status(): Promise<ReminderStatus>
  requestNotifications(): Promise<void>
  requestExact(): Promise<void>
  openSystemSettings(): Promise<void>
  sync(rows: Reminder[], now: number): Promise<void>
}

const androidSettings = registerPlugin<{ open(): Promise<void> }>('ReminderSettings')
const channelId = 'tidyberrie-reminders'
const signature = (item: Reminder) => JSON.stringify([item.key, item.at, item.title])

export class WebNotificationScheduler implements NotificationScheduler {
  readonly platform = 'web'
  constructor(private claims: DeliveryClaims) {}

  async status(): Promise<ReminderStatus> {
    const permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
    return { notifications: permission === 'default' ? 'prompt' : permission, exact: 'unsupported' }
  }

  async requestNotifications() {
    if (typeof Notification !== 'undefined') await Notification.requestPermission()
  }

  async requestExact() {}
  async openSystemSettings() {}

  async sync(rows: Reminder[], now: number) {
    if ((await this.status()).notifications !== 'granted') return
    const worker = await navigator.serviceWorker?.getRegistration()
    for (const row of rows) {
      if (row.at > now || row.at < now - minute || !await this.claims.claim(row.key, row.at)) continue
      const options = { body: row.title, tag: row.key, icon: '/icon-192.png' }
      try {
        if (worker?.active) await worker.showNotification('Tidyberrie reminder', options)
        else new Notification('Tidyberrie reminder', options)
      } catch {
        await this.claims.release(row.key, row.at)
      }
    }
  }
}

export class AndroidLocalNotificationScheduler implements NotificationScheduler {
  readonly platform = 'android'
  private channelCreated = false
  constructor(private plugin: LocalNotificationsPlugin = LocalNotifications) {}

  async status(): Promise<ReminderStatus> {
    const [permission, setting, enabled] = await Promise.all([
      this.plugin.checkPermissions(), this.plugin.checkExactNotificationSetting(), this.plugin.areEnabled(),
    ])
    return {
      notifications: permission.display === 'prompt-with-rationale' || (permission.display === 'granted' && !enabled.value)
        ? 'denied' : permission.display,
      exact: setting.exact_alarm === 'prompt-with-rationale' ? 'prompt' : setting.exact_alarm,
    }
  }

  async requestNotifications() { await this.plugin.requestPermissions() }
  async requestExact() { await this.plugin.changeExactNotificationSetting() }
  async openSystemSettings() { await androidSettings.open() }

  async sync(rows: Reminder[], now: number) {
    const status = await this.status()
    const { notifications: pending } = await this.plugin.getAll({ state: 'SCHEDULED' })
    const owned = pending.filter(item => item.extra?.namespace === channelId)
    const desired = new Map<number, Reminder>()
    for (const row of [...rows].sort((a, b) => a.key.localeCompare(b.key))) {
      let id = notificationId(row.key)
      while (desired.has(id)) id = id === 2147483646 ? 1 : id + 1
      desired.set(id, row)
    }
    const accessible = status.notifications === 'granted'
    const exact = status.exact === 'granted'
    const keep = new Set<number>()
    const obsolete = owned.filter(item => {
      const next = desired.get(item.id)
      if (!accessible || !next || item.extra.signature !== signature(next) || item.extra.exact !== exact) return true
      keep.add(item.id)
      return false
    })
    if (obsolete.length) await this.plugin.cancel({ notifications: obsolete.map(({ id }) => ({ id })) })
    if (!accessible) return
    const future = [...desired].flatMap(([id, row]) => keep.has(id) || row.at <= now ? [] : [{
      id, title: row.key === testKey ? 'Tidyberrie test reminder' : 'Tidyberrie reminder',
      body: row.title, channelId, schedule: { at: new Date(row.at), allowWhileIdle: true },
      isExactNotification: exact,
      extra: { namespace: channelId, signature: signature(row), exact },
    }])
    if (!future.length) return
    if (!this.channelCreated) {
      await this.plugin.createChannel({ id: channelId, name: 'Task reminders', importance: 4, visibility: 0 })
      this.channelCreated = true
    }
    await this.plugin.schedule({ notifications: future })
  }
}

export function selectScheduler(claims: DeliveryClaims, platform = Capacitor.getPlatform()): NotificationScheduler {
  return platform === 'android' ? new AndroidLocalNotificationScheduler() : new WebNotificationScheduler(claims)
}
