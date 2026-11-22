import { format } from 'date-fns'
import { backupSchema } from './schemas'
import * as repository from './backupRepository'

export const maxBackupSize = 10 * 1024 * 1024

export function decodeBackup(content: string) {
  if (new TextEncoder().encode(content).byteLength > maxBackupSize) throw new Error('Backup is too large')
  return backupSchema.parse(JSON.parse(content))
}

export async function readBackup(file: File) {
  if (file.size > maxBackupSize) throw new Error('Backup is too large')
  return decodeBackup(await file.text())
}

export function saveDailySnapshot(now = new Date()) {
  return repository.dailySnapshot(format(now, 'yyyy-MM-dd'))
}

export const exportBackup = repository.exportBackup
export const restoreBackup = repository.importBackup
