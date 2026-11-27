import { format } from 'date-fns'
import { z } from './strictValidation'
import { backupSchema } from './schemas'
import { decryptBackup, encryptBackup } from './crypto'
import * as repository from './backupRepository'
import { csvCell } from '../../features/budget/csv'

export const maxBackupSize = 10 * 1024 * 1024
const maxEnvelopeSize = Math.ceil((maxBackupSize + 16) / 3) * 4 + 512
const size = (content: string) => new TextEncoder().encode(content).byteLength

export function decodeBackup(content: string) {
  if (size(content) > maxBackupSize) throw new Error('Backup is too large')
  return backupSchema.parse(JSON.parse(content))
}

export async function readBackup(file: File, passphrase: string) {
  if (file.size > maxEnvelopeSize) throw new Error('Backup is too large')
  const content = await file.text()
  if (file.size > maxBackupSize && !passphrase) throw new Error('Backup is too large')
  const parsed: unknown = JSON.parse(content)
  if (z.object({ format: z.literal('tidyberrie-aes-gcm') }).safeParse(parsed).success) {
    return decodeBackup(await decryptBackup(parsed, passphrase))
  }
  return decodeBackup(content)
}

export async function makeExport(kind: 'json' | 'encrypted' | 'csv', passphrase: string) {
  const backup = await repository.exportBackup()
  if (kind === 'csv') {
    const rows = Object.entries(backup.data).filter(([name]) => name !== 'snapshots').flatMap(([name, records]) =>
      records.map(record => [name, record.id, ...['title', 'name', 'source', 'category', 'person', 'amount', 'openingBalance', 'status', 'date', 'categoryId', 'groupId', 'optional', 'estimateMinutes', 'actualMinutes', 'originalDate', 'rescheduleCount', 'scheduleId', 'alertNotify', 'alertAlarm']
        .map(key => String(Reflect.get(record, key) ?? '')), JSON.stringify(record)]))
    const header = ['Table', 'ID', 'Title', 'Name', 'Source', 'Category', 'Person', 'Amount (centavos)', 'Opening (centavos)', 'Status', 'Date', 'Category ID', 'Group ID', 'Optional', 'Estimated minutes', 'Actual minutes', 'Original date', 'Reschedule count', 'Schedule ID', 'Notify', 'Alarm', 'Record JSON']
    return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
  }
  const content = JSON.stringify(backup)
  if (size(content) > maxBackupSize) throw new Error('Backup is too large')
  return kind === 'encrypted' ? encryptBackup(content, passphrase) : content
}

export function backupCounts(data: Omit<z.infer<typeof backupSchema>['data'], 'snapshots'>) {
  return Object.entries(data).filter(([name]) => name !== 'snapshots').map(([name, rows]) => ({ name, count: rows.length }))
}

export function saveDailySnapshot(now = new Date()) {
  return repository.dailySnapshot(format(now, 'yyyy-MM-dd'))
}

export function restoreBackup(backup: unknown, mode: unknown) {
  return repository.importBackup(backupSchema.parse(backup), z.enum(['merge', 'replace']).parse(mode))
}

export function restoreSnapshot(id: unknown) {
  return repository.restoreSnapshot(z.uuid().parse(id), format(new Date(), 'yyyy-MM-dd'))
}

export function deleteAllData(confirmation: unknown) {
  z.literal('DELETE').parse(confirmation)
  return repository.deleteAllData()
}

export async function recoveryOverview() {
  const overview = await repository.recoveryOverview()
  const summarize = (snapshot: NonNullable<typeof overview.safety>) => ({
    id: snapshot.id, day: snapshot.day, createdAt: snapshot.createdAt, counts: backupCounts(snapshot.data),
  })
  return { ...overview, snapshots: overview.snapshots.map(summarize), safety: overview.safety && summarize(overview.safety) }
}
export const recordExport = repository.recordExport


export const claimBackupNudge = () => repository.claimBackupNudge(Date.now())
