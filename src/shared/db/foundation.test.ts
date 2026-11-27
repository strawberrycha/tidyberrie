import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { emptyTask } from '../../features/tasks/input'
import { storedTask } from '../../features/tasks/model'
import { metadata } from './repository'
import { afterEach, describe, expect, it } from 'vitest'
import { addCentavos, centavos } from '../utils/money'
import { applyTheme } from '../theme/tokens'
import { db, openDatabase, table } from './database'
import { Repository } from './repository'
import { recordSchemas } from './schemas'
import { decodeBackup, makeExport } from './backupService'
import { dailySnapshot, exportBackup, importBackup } from './backupRepository'

afterEach(async () => {
  await Promise.all(db.tables.map(target => target.clear()))
})

it('migrates v8 task records and seeds ten categories exactly once', async () => {
  const name = 'migration-' + crypto.randomUUID()
  const legacy = new Dexie(name)
  legacy.version(8).stores({ tasks: 'id,startAt,endAt,status,deletedAt', taskExceptions: 'id,taskId,date,[taskId+date],movedTo,deletedAt' })
  const stamp = metadata()
  await legacy.table('tasks').add({ ...stamp, title: 'Old task', status: 'doing', startAt: '2024-02-29', color: 'mint' })
  legacy.close()
  const upgraded = openDatabase(name)
  try {
    expect(await table('tasks', upgraded).get(stamp.id)).toMatchObject({
      ...stamp, title: 'Old task', status: 'in_progress', startAt: '2024-02-29', color: 'mint', categoryId: null, optional: false,
    })
    expect(await table('categories', upgraded).count()).toBe(10)
    upgraded.close()
    await upgraded.open()
    expect(await table('categories', upgraded).count()).toBe(10)
  } finally {
    await upgraded.delete()
  }
})

it('imports category-free v1 backups and exports the new columns', async () => {
  const backup = await exportBackup()
  const data: Record<string, unknown> = { ...backup.data }
  delete data.categories
  delete data.schedules
  const task = { ...metadata(), ...storedTask({ ...emptyTask('2024-02-29'), title: 'Legacy task' }, 0) }
  data.tasks = [{ ...task, status: 'doing', categoryId: undefined, originalDate: undefined, estimateMinutes: undefined }]
  const decoded = decodeBackup(JSON.stringify({ ...backup, data }))
  expect(decoded.data.categories).toEqual([])
  expect(decoded.data.groups).toEqual([])
  expect(decoded.data.schedules).toEqual([])
  await importBackup(decoded, 'replace')
  expect(await table('tasks').get(task.id)).toMatchObject({ status: 'in_progress', categoryId: null, estimateMinutes: null })
  expect(await makeExport('csv', '')).toContain('Estimated minutes')
  expect(recordSchemas.tasks.safeParse({ ...task, estimateMinutes: 1441 }).success).toBe(false)
  expect(recordSchemas.tasks.safeParse({ ...task, actualMinutes: -1 }).success).toBe(false)
})

describe('repository', () => {
  const accounts = new Repository(table('accounts'), recordSchemas.accounts)
  const values = { name: 'Sample', type: 'cash' as const, openingBalance: 105, color: '', icon: '' }

  it('soft-deletes, restores and lists active records', async () => {
    const account = await accounts.create(values)
    await accounts.softDelete(account.id)
    expect(await accounts.list()).toEqual([])
    expect((await table('accounts').get(account.id))?.deletedAt).toBeTruthy()
    await accounts.restore(account.id)
    expect(await accounts.list()).toMatchObject([{ id: account.id, deletedAt: null }])
  })

  it('purges records older than 30 days without purging the boundary or active rows', async () => {
    const old = await accounts.create(values)
    const boundary = await accounts.create(values)
    const current = await accounts.create(values)
    await table('accounts').update(old.id, { deletedAt: '2026-10-01T00:00:00.000Z' })
    await table('accounts').update(boundary.id, { deletedAt: '2026-10-02T00:00:00.000Z' })
    expect(await accounts.purge(new Date('2026-11-01T00:00:00.000Z'))).toBe(1)
    expect(await table('accounts').get(old.id)).toBeUndefined()
    expect(await table('accounts').get(boundary.id)).toBeDefined()
    expect(await table('accounts').get(current.id)).toBeDefined()
  })
})

it('uses safe integer centavos throughout addition', () => {
  expect(addCentavos(105, 220, -25)).toBe(300)
  expect(() => centavos.parse(1.01)).toThrow()
  expect(() => addCentavos(Number.MAX_SAFE_INTEGER, 1)).toThrow()
})

it('rejects malformed backups and mutable account balances', async () => {
  expect(() => decodeBackup('{')).toThrow()
  expect(() => decodeBackup('{"version":1,"data":{}}')).toThrow()
  const backup = await exportBackup()
  expect(decodeBackup(JSON.stringify(backup))).toEqual(backup)
  const account = await new Repository(table('accounts'), recordSchemas.accounts).create({
    name: 'Testing', type: 'cash', openingBalance: 100, color: '', icon: '',
  })
  expect(() => decodeBackup(JSON.stringify({
    ...backup, data: { ...backup.data, accounts: [{ ...account, balance: 100 }] },
  }))).toThrow()
})

it('replaces records and merges matching records by id', async () => {
  const accounts = new Repository(table('accounts'), recordSchemas.accounts)
  const account = await accounts.create({ name: 'Sample', type: 'cash', openingBalance: 100, color: '', icon: '' })
  const original = await exportBackup()
  await accounts.update(account.id, { name: 'Changed' })
  await accounts.create({ name: 'Local', type: 'cash', openingBalance: 200, color: '', icon: '' })
  await importBackup(original, 'merge')
  expect((await accounts.list()).map(value => value.name).sort()).toEqual(['Local', 'Sample'])
  await importBackup(original, 'replace')
  expect(await accounts.list()).toEqual([account])
})

it('applies each theme to the CSS token selector', () => {
  const root = document.createElement('div')
  applyTheme('sakura', root)
  expect(root.matches('[data-theme="sakura"]')).toBe(true)
  applyTheme('strawberry', root)
  expect(root.matches('[data-theme="strawberry"]')).toBe(true)
})

it('retains the latest seven distinct daily snapshots', async () => {
  for (let day = 1; day <= 9; day++) {
    await dailySnapshot(`2026-11-0${day}`)
  }
  await dailySnapshot('2026-11-09')
  expect((await table('snapshots').orderBy('day').toArray()).map(record => record.day)).toEqual([
    '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09',
  ])
})

it('creates a safety snapshot atomically and can reverse a snapshot restore', async () => {
  const recovery = await import('./backupService')
  const accounts = new Repository(table('accounts'), recordSchemas.accounts)
  const account = await accounts.create({ name: 'Before', type: 'cash', openingBalance: 100, color: '', icon: '' })
  await dailySnapshot('2026-11-21')
  const daily = (await recovery.recoveryOverview()).snapshots[0]
  await accounts.update(account.id, { name: 'After' })
  await recovery.restoreSnapshot(daily.id)
  expect((await accounts.list())[0].name).toBe('Before')
  const safety = (await recovery.recoveryOverview()).safety
  await recovery.restoreSnapshot(safety?.id)
  expect((await accounts.list())[0].name).toBe('After')
  await expect(async () => recovery.deleteAllData('delete')).rejects.toThrow()
  await recovery.deleteAllData('DELETE')
  expect(await accounts.list()).toEqual([])
  expect((await recovery.recoveryOverview()).safety).toBeUndefined()
})

it('round trips authenticated backups and rejects a wrong passphrase', async () => {
  const { encryptBackup, decryptBackup } = await import('./crypto')
  const password = 'sample passphrase'
  const content = JSON.stringify(await exportBackup())
  const a = JSON.parse(await encryptBackup(content, password))
  const b = JSON.parse(await encryptBackup(content, password))
  expect(a.salt).not.toBe(b.salt)
  expect(await decryptBackup(a, password)).toBe(content)
  await expect(decryptBackup(a, 'another wrong passphrase')).rejects.toThrow()
})

it('persists retry throttling and disallows disabling a lock before unlock', async () => {
  const { configureLock, disableLock, getLock, verifyPin } = await import('../../features/settings/lockService')
  const version = await configureLock('135791', 60)
  const portable = JSON.stringify(await exportBackup())
  expect(portable).not.toContain(version)
  expect(portable).not.toContain('135791')
  await expect(disableLock()).rejects.toThrow()
  await verifyPin('246802')
  await verifyPin('246802')
  const failed = await verifyPin('246802')
  expect(failed.retryAt).toBeGreaterThan(Date.now())
  expect((await getLock()).retryAt).toBe(failed.retryAt)
  expect(await verifyPin('135791')).toEqual({ retryAt: failed.retryAt })
  await disableLock(version)
  expect((await getLock()).enabled).toBe(false)
})

it('waits a week before the first backup nudge and between subsequent nudges', async () => {
  const { claimBackupNudge } = await import('./backupRepository')
  const start = Date.UTC(2026, 10, 22, 4)
  const week = 7 * 24 * 60 * 60 * 1000
  expect(await claimBackupNudge(start)).toBe(false)
  expect(await claimBackupNudge(start + week - 1)).toBe(false)
  expect(await claimBackupNudge(start + week)).toBe(true)
  expect(await claimBackupNudge(start + week)).toBe(false)
  expect(await claimBackupNudge(start + 2 * week)).toBe(true)
})
