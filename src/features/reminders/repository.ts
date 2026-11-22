import { liveQuery } from 'dexie'
import { db } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import type { RecordMetadata } from '../../shared/db/schemas'
import type { Disposition } from './window'

export type DeviceRecord = RecordMetadata & { key: string; value: number; sourceAt: number; dismissed?: boolean }
const storage = db.table<DeviceRecord, string>('reminderDevice')

export function observeRecords(next: (records: DeviceRecord[]) => void, error: () => void) {
  const subscription = liveQuery(() => storage.toArray()).subscribe({ next, error })
  return () => subscription.unsubscribe()
}

export function saveRecord(key: string, value: number, sourceAt: number, dismissed?: boolean) {
  return db.transaction('rw', storage, async () => {
    const existing = await storage.get({ key })
    const stamp = metadata()
    const next = { ...stamp, ...existing, key, value, sourceAt, dismissed, updatedAt: stamp.updatedAt }
    await storage.put(next)
    if (!dismissed) return
    return () => db.transaction('rw', storage, async () => {
      const current = await storage.get(next.id)
      if (!current || current.updatedAt !== next.updatedAt || !current.dismissed) throw new Error('Reminder changed')
      if (existing) await storage.put(existing)
      else await storage.delete(next.id)
    })
  })
}

export function dispositions(records: DeviceRecord[]) {
  const items = new Map<string, Disposition>()
  for (const record of records) {
    if (record.key.startsWith('state:')) {
      items.set(record.key.slice(6), { sourceAt: record.sourceAt, snoozeAt: record.value, dismissed: record.dismissed })
    }
  }
  return items
}

export function claimWebDelivery(key: string, at: number) {
  return db.transaction('rw', storage, async () => {
    const claimKey = 'sent:' + key + ':' + at
    if (await storage.get({ key: claimKey })) return false
    await storage.add({ ...metadata(), key: claimKey, value: Date.now(), sourceAt: at })
    return true
  })
}

export async function releaseWebDelivery(key: string, at: number) {
  await storage.where('key').equals('sent:' + key + ':' + at).delete()
}

export async function pruneRecords(before: number) {
  await storage.where('sourceAt').between(1, before, true, false).delete()
}
