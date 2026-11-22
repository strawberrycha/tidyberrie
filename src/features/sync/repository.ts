import { db, table } from '../../shared/db/database'
import { canonicalTime, collections, compare, fingerprint, keyFor, portable } from './model'
import type { Change, Collection, Cursor, Revision, Value } from './model'

type Device = { id: 'device'; deviceId: string; uid: string; enabled: boolean; cursor?: Cursor; lastSync?: string }
type Entry = Revision & { key: string; collection: Collection; seen: string | null; pending: 0 | 1; value: Value | null }
const devices = db.table<Device, string>('syncDevice')
const entries = db.table<Entry, string>('syncRecords')
const data = collections.map(name => table(name))
const scope = [...data, entries, devices]

export const readDevice = () => devices.get('device')

export function enableDevice(uid: string) {
  return db.transaction('rw', devices, async () => {
    const current = await readDevice()
    if (current && current.uid !== uid) throw new Error('DifferentAccount')
    const next: Device = current ? { ...current, enabled: true }
      : { id: 'device', uid, deviceId: crypto.randomUUID(), enabled: true }
    await devices.put(next)
    return next
  })
}

export async function disableDevice() {
  await devices.update('device', { enabled: false })
}

async function requireDevice(uid: string) {
  const device = await readDevice()
  if (!device?.enabled || device.uid !== uid) throw new Error('SyncStopped')
  return device
}

async function readLocal(names: readonly Collection[] = collections) {
  const rows = new Map<string, { value: Value; collection: Collection; ids: string[] }>()
  for (const collection of names) {
    for (const original of await table(collection).toArray()) {
      const value = portable(collection, original)
      if (!value) continue
      const key = keyFor(collection, value)
      const existing = rows.get(key)
      if (!existing) rows.set(key, { value, collection, ids: [value.id] })
      else {
        existing.ids.push(value.id)
        const a = canonicalTime(value.updatedAt) + value.id
        const b = canonicalTime(existing.value.updatedAt) + existing.value.id
        if (a > b) existing.value = value
      }
    }
  }
  return rows
}

function markLocal(device: Device, old: Entry | undefined, collection: Collection, key: string, value: Value | null) {
  const seen = fingerprint(value)
  if (old?.seen === seen) return old
  if (old && collection === 'budgetHistory') return old
  const time = value ? Date.parse(value.updatedAt) : Date.now()
  const updatedAt = new Date(old ? Math.max(time, Date.parse(old.updatedAt) + 1) : time).toISOString()
  return {
    key, collection, value, seen, updatedAt, deviceId: device.deviceId, pending: 1 as const,
    deletedAt: value ? value.deletedAt && canonicalTime(value.deletedAt) : updatedAt,
  }
}

async function collect(device: Device) {
  const local = await readLocal()
  const known = new Map((await entries.toArray()).map(entry => [entry.key, entry]))
  const changes: Entry[] = []
  for (const [key, row] of local) {
    const old = known.get(key)
    const next = markLocal(device, old, row.collection, key, row.value)
    if (next && next !== old) changes.push(next)
  }
  for (const [key, old] of known) {
    if (local.has(key)) continue
    const next = markLocal(device, old, old.collection, key, null)
    if (next && next !== old) changes.push(next)
  }
  await entries.bulkPut(changes)
  return local
}

export async function capture(uid: string) {
  return db.transaction('rw', scope, async () => { await collect(await requireDevice(uid)) })
}

export async function pending(uid: string, limit: number): Promise<Change[]> {
  return db.transaction('r', [entries, devices], async () => {
    await requireDevice(uid)
    return entries.where('pending').equals(1).limit(limit).toArray()
  })
}

export function applyIncoming(uid: string, changes: Change[], cursor?: Cursor) {
  return db.transaction('rw', scope, async () => {
    const device = await requireDevice(uid)
    const local = await readLocal([...new Set(changes.map(change => change.collection))])
    let conflicts = 0
    for (const change of changes) {
      const rows = local.get(change.key)
      const prior = await entries.get(change.key)
      const existing = rows || prior ? markLocal(device, prior, change.collection, change.key, rows?.value ?? null) : undefined
      if (existing && existing !== prior) await entries.put(existing)
      if (existing && compare(change, existing) < 0 && change.collection !== 'budgetHistory') {
        conflicts += existing.pending
        continue
      }
      const same = existing && compare(change, existing) === 0
      if (same) {
        if (existing.pending) await entries.update(change.key, { pending: 0 })
        continue
      }
      conflicts += existing?.pending ?? 0
      const target = table(change.collection)
      const obsolete = rows?.ids.filter(id => id !== change.value?.id) ?? []
      await target.bulkDelete(obsolete)
      if (change.value) {
        const value = change.collection === 'settings' && 'key' in change.value
          ? { ...change.value, storagePersistent: null }
          : change.value
        if (change.collection !== 'settings' || !rows || fingerprint(value) !== fingerprint(rows.value)) {
          await target.put(value)
        }
      }
      await entries.put({ ...change, seen: fingerprint(change.value), pending: 0 })
    }
    if (cursor && (!device.cursor || cursor.seconds > device.cursor.seconds ||
      (cursor.seconds === device.cursor.seconds && (cursor.nanoseconds > device.cursor.nanoseconds ||
       (cursor.nanoseconds === device.cursor.nanoseconds && cursor.id > device.cursor.id))))) {
      await devices.update('device', { cursor })
    }
    return conflicts
  })
}

export function finish(uid: string) {
  return db.transaction('rw', devices, async () => {
    await requireDevice(uid)
    const lastSync = new Date().toISOString()
    await devices.update('device', { lastSync })
    return lastSync
  })
}
