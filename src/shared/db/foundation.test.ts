import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { addCentavos, centavos } from '../utils/money'
import { applyTheme } from '../theme/tokens'
import { db, table } from './database'
import { Repository } from './repository'
import { recordSchemas } from './schemas'
import { decodeBackup } from './backupService'
import { dailySnapshot, exportBackup, importBackup } from './backupRepository'

afterEach(async () => {
  await Promise.all(db.tables.map(target => target.clear()))
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
