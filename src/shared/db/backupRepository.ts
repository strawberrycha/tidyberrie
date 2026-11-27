import Dexie from 'dexie'
import { convertScheduleRecords } from './categoryMigration'
import { db, table } from './database'
import { metadata } from './repository'
import type { Backup, Records } from './schemas'
import { backupDataSchema } from './schemas'

const names = ['groups', 'schedules', 'categories', 'tasks', 'subtasks', 'taskExceptions', 'dayThemes', 'accounts', 'incomes', 'expenses', 'transfers', 'categoryBudgets', 'goals', 'debts', 'budgetHistory', 'settings', 'snapshots'] as const
const tables = names.map(name => table(name))
const recovery = db.table<{ id: string; snapshot?: Records['snapshots']; exportedAt?: string }, string>('recoveryDevice')
const reminderState = db.table('reminderDevice')

async function read<K extends keyof Records>(name: K): Promise<Records[K][]> {
  return table(name).toArray()
}

async function readData() {
  return {
    groups: await read('groups'), schedules: await read('schedules'), categories: await read('categories'), tasks: await read('tasks'), subtasks: await read('subtasks'), taskExceptions: await read('taskExceptions'),
    dayThemes: await read('dayThemes'), accounts: await read('accounts'), incomes: await read('incomes'),
    expenses: await read('expenses'), transfers: await read('transfers'), budgetHistory: await read('budgetHistory'), settings: await read('settings'),
    categoryBudgets: await read('categoryBudgets'), goals: await read('goals'), debts: await read('debts'),
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
    if (name === 'categories') {
      const category = record as Records['categories']
      const categories = table('categories')
      const existing = await categories.get(record.id)
      if (existing && existing.updatedAt > record.updatedAt) continue
      const conflict = !category.archived && !category.deletedAt && await categories.filter(item =>
        item.id !== category.id && !item.archived && !item.deletedAt && item.name.toLowerCase() === category.name.toLowerCase()).first()
      await categories.put(conflict ? { ...category, archived: true } : category)
      continue
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
  return db.transaction('rw', [...tables, recovery, reminderState], async () => {
    if (mode === 'replace') {
      await captureSafety(localDay())
      await reminderState.clear()
      for (const target of tables) await target.clear()
    }
    for (const name of names) await write(name, backup.data[name])
    await convertScheduleRecords(Dexie.currentTransaction!, false)
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


function localDay() {
  const date = new Date()
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(value => String(value).padStart(2, '0')).join('-')
}

async function captureSafety(day: string) {
  await recovery.put({ id: 'safety', snapshot: { ...metadata(), day, data: await readData() } })
}

export async function recoveryOverview() {
  return db.transaction('r', [table('snapshots'), recovery], async () => ({
    snapshots: await table('snapshots').orderBy('day').reverse().toArray(),
    safety: (await recovery.get('safety'))?.snapshot,
    exportedAt: (await recovery.get('export'))?.exportedAt,
  }))
}

export async function recordExport() {
  await recovery.put({ id: 'export', exportedAt: new Date().toISOString() })
}

export async function restoreSnapshot(id: string, day: string) {
  return db.transaction('rw', [...tables, recovery, reminderState], async () => {
    const safety = (await recovery.get('safety'))?.snapshot
    const snapshot = safety?.id === id ? safety : await table('snapshots').get(id)
    if (!snapshot) throw new Error('Snapshot unavailable')
    const data = backupDataSchema.parse(snapshot.data)
    await captureSafety(day)
    await reminderState.clear()
    for (const name of names) {
      if (name === 'snapshots') continue
      await table(name).clear()
      await write(name, data[name])
    }
    await convertScheduleRecords(Dexie.currentTransaction!, false)
  })
}

export async function deleteAllData() {
  const targets = db.tables
  await db.transaction('rw', targets, async () => {
    for (const target of targets) await target.clear()
  })
}



export async function claimBackupNudge(now: number) {
  return db.transaction('rw', recovery, async () => {
    const latestExport = Date.parse((await recovery.get('export'))?.exportedAt ?? '') || 0
    const latestNudge = Date.parse((await recovery.get('nudge'))?.exportedAt ?? '') || 0
    if (!latestExport && !latestNudge) {
      await recovery.put({ id: 'nudge', exportedAt: new Date(now).toISOString() })
      return false
    }
    if (now - Math.max(latestExport, latestNudge) < 7 * 24 * 60 * 60 * 1000) return false
    await recovery.put({ id: 'nudge', exportedAt: new Date(now).toISOString() })
    return true
  })
}
