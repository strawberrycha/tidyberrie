import 'fake-indexeddb/auto'
import { afterEach, expect, it } from 'vitest'
import { db, table } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import { recordSchemas } from '../../shared/db/schemas'
import { decodeChange, encodeChange, newProfile, unlockProfile } from './encryption'
import { synchronize } from './engine'
import type { Transport } from './engine'
import { compare, pageSize } from './model'
import type { Change, Wire } from './model'
import { disableDevice, enableDevice, pending, readDevice } from './repository'

const a = '00000000-0000-4000-8000-000000000001'
const b = '00000000-0000-4000-8000-000000000002'
const time = (second: number) => new Date(Date.UTC(2026, 10, 22, 0, 0, second)).toISOString()
const tasks = table('tasks')
const uid = 'sample-account'

afterEach(async () => {
  await Promise.all(db.tables.map(target => target.clear()))
})

function task(title = 'Local task') {
  return recordSchemas.tasks.parse({
    ...metadata(), createdAt: time(0), updatedAt: time(0), title, description: '', startAt: '2026-11-22', endAt: null,
    allDay: true, color: 'rose', icon: 'check', tag: '', status: 'todo', priority: 'low',
    repeatRule: null, reminders: [], autoCompleteWhenSubtasksDone: false, pinned: false,
  })
}

function memoryCloud() {
  let clock = 0
  let offline = false
  let writes = 0
  const rows = new Map<string, { id: string; data: Wire; at: number }>()
  const save = (id: string, data: Wire) => {
    const row = { id, data, at: ++clock }
    rows.set(id, row)
    return row
  }
  const remote: Transport = {
    profile: async () => ({ version: 1, encrypted: false }),
    createProfile: async value => value,
    pull: async cursor => {
      if (offline) throw new Error('Offline')
      const records = [...rows.values()].filter(row => row.at > (cursor?.seconds ?? 0)).slice(0, pageSize)
      const last = records.at(-1)
      return { records, cursor: last && { seconds: last.at, nanoseconds: 0, id: last.id } }
    },
    push: async batch => batch.map(({ id, data }) => {
      const current = rows.get(id)
      if (current && (data.collection === 'budgetHistory' || compare(data, current.data) <= 0)) return current
      writes++
      return save(id, data)
    }),
  }
  return { remote, rows, save, writes: () => writes, goOffline: (value: boolean) => { offline = value } }
}

it('uses time and device ID for same-record conflicts and delete versus edit', () => {
  expect(compare({ updatedAt: time(0), deviceId: b, deletedAt: null },
    { updatedAt: time(0), deviceId: a, deletedAt: time(0) })).toBe(1)
  expect(compare({ updatedAt: time(1), deviceId: a, deletedAt: time(1) },
    { updatedAt: time(0), deviceId: b, deletedAt: null })).toBe(1)
})

it('merges offline edits with a tombstone and retries without duplicate writes', async () => {
  const cloud = memoryCloud()
  const record = task()
  const independent = task('Offline creation')
  const key = 'tasks__' + record.id
  await enableDevice(uid)
  await tasks.put(record)
  await synchronize(uid, cloud.remote)
  expect(cloud.writes()).toBe(1)
  await synchronize(uid, cloud.remote)
  expect(cloud.writes()).toBe(1)

  await tasks.update(record.id, { title: 'Offline edit', updatedAt: time(1) })
  await tasks.add(independent)
  cloud.goOffline(true)
  await expect(synchronize(uid, cloud.remote)).rejects.toThrow('Offline')
  expect(await pending(uid, pageSize)).toHaveLength(2)

  cloud.save(key, await encodeChange(uid, {
    key, deviceId: b, collection: 'tasks', updatedAt: time(2), deletedAt: time(2),
    value: { ...record, updatedAt: time(2), deletedAt: time(2) },
  }))
  cloud.goOffline(false)
  const result = await synchronize(uid, cloud.remote)
  expect(result.conflicts).toBe(1)
  expect((await tasks.get(record.id))?.deletedAt).toBe(time(2))
  expect(cloud.rows.has('tasks__' + independent.id)).toBe(true)
  expect(cloud.writes()).toBe(2)
  await synchronize(uid, cloud.remote)
  expect(cloud.writes()).toBe(2)
  expect((await readDevice())?.cursor).toBeDefined()
})

it('publishes a permanent removal and keeps local data when sync is disabled', async () => {
  const cloud = memoryCloud()
  const item = task()
  await enableDevice(uid)
  await tasks.add(item)
  await synchronize(uid, cloud.remote)
  await tasks.delete(item.id)
  await synchronize(uid, cloud.remote)
  expect(cloud.rows.get('tasks__' + item.id)?.data).toMatchObject({ payload: 'null', deletedAt: expect.any(String) })
  await tasks.add(task('Kept when disabled'))
  await disableDevice()
  await expect(synchronize(uid, cloud.remote)).rejects.toThrow('SyncStopped')
  expect(await tasks.count()).toBe(1)
  await expect(enableDevice('different')).rejects.toThrow('DifferentAccount')
})

it('encrypts record contents and authenticates the cloud record metadata', async () => {
  const passphrase = 'fixture sync phrase'
  const profile = await newProfile(uid, true, passphrase)
  await expect(unlockProfile(uid, profile, 'wrong passphrase')).rejects.toThrow()
  const key = await unlockProfile(uid, profile, passphrase)
  const record = task('Only visible locally')
  const change: Change = { key: 'tasks__' + record.id, collection: 'tasks', deviceId: a,
    updatedAt: time(0), deletedAt: null, value: record }
  const wire = await encodeChange(uid, change, key)
  expect(wire.payload).not.toContain(record.title)
  expect(await decodeChange(uid, change.key, wire, key)).toEqual(change)
  await expect(decodeChange(uid, change.key, { ...wire, deviceId: b }, key)).rejects.toThrow()
})
