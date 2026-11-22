import { db, table } from './database'
import { metadata } from './repository'
import type { Backup, Records } from './schemas'

const names = ['tasks', 'subtasks', 'taskExceptions', 'dayThemes', 'accounts', 'incomes', 'expenses', 'transfers', 'budgetHistory', 'settings', 'snapshots'] as const
const tables = names.map(name => table(name))

async function read<K extends keyof Records>(name: K): Promise<Records[K][]> {
  return table(name).toArray()
}

async function readData() {
  return {
    tasks: await read('tasks'), subtasks: await read('subtasks'), taskExceptions: await read('taskExceptions'),
    dayThemes: await read('dayThemes'), accounts: await read('accounts'), incomes: await read('incomes'),
    expenses: await read('expenses'), transfers: await read('transfers'), budgetHistory: await read('budgetHistory'), settings: await read('settings'),
  }
}

export function exportBackup(): Promise<Backup> {
  return db.transaction('r', tables, async () => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { ...await readData(), snapshots: await read('snapshots') },
  }))
}

async function write<K extends keyof Records>(name: K, records: Records[K][]) {
  const target = table(name)
  for (const record of records) {
    if ('key' in record || 'day' in record) {
      const index = 'key' in record ? { key: record.key } : { day: record.day }
      const existing = await target.get(index)
      if (existing && existing.id !== record.id) await target.delete(existing.id)
    }
    const next = 'key' in record && record.key === 'preferences'
      ? { ...record, storagePersistent: null }
      : record
    await target.put(next)
  }
}

async function rotateSnapshots() {
  const snapshots = table('snapshots')
  const oldest = (await snapshots.orderBy('day').reverse().toArray()).slice(7)
  await snapshots.bulkDelete(oldest.map(record => record.id))
}

export function importBackup(backup: Backup, mode: 'merge' | 'replace') {
  return db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      for (const target of tables) await target.clear()
    }
    for (const name of names) await write(name, backup.data[name])
    await rotateSnapshots()
  })
}

export function dailySnapshot(day: string) {
  const snapshots = table('snapshots')
  return db.transaction('rw', tables, async () => {
    if (!(await snapshots.get({ day }))) {
      await snapshots.add({ ...metadata(), day, data: await readData() })
    }
    await rotateSnapshots()
  })
}
