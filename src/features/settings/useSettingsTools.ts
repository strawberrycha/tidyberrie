import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import * as backupService from '../../shared/db/backupService'
import type { Backup } from '../../shared/db/schemas'
import { useTheme } from '../../shared/theme/ThemeProvider'
import { useToast } from '../../shared/ui/Toast'

export function useSettingsTools() {
  const [backup, setBackup] = useState<Backup>()
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const { refresh } = useTheme()
  const show = useToast()
  const overview = useLiveQuery(async () => {
    try { return await backupService.recoveryOverview() } catch { return null }
  }, [])

  async function perform(work: () => Promise<void>, error: string) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    try { await work() } catch { show({ message: error }) } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return {
    overview, backup, busy, importCounts: backup ? backupService.backupCounts(backup.data) : [],
    download: (kind: 'json' | 'encrypted' | 'csv', passphrase: string) => perform(async () => {
      const content = await backupService.makeExport(kind, passphrase)
      const url = URL.createObjectURL(new Blob([content], { type: kind === 'csv' ? 'text/csv' : 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = kind === 'csv' ? 'tidyberrie-data.csv' : kind === 'encrypted' ? 'tidyberrie-encrypted.json' : 'tidyberrie-backup.json'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      if (kind !== 'csv') await backupService.recordExport()
      show({ message: kind === 'csv' ? 'CSV download started.' : 'Backup download started.' })
    }, 'Could not export. Check your passphrase or backup size.'),
    select: (file: File, passphrase: string) => perform(async () => {
      setBackup(undefined)
      setBackup(await backupService.readBackup(file, passphrase))
    }, 'Could not read the backup. Check the file, its size, and the passphrase for encrypted backups.'),
    importData: (mode: 'merge' | 'replace') => perform(async () => {
      if (!backup) return
      await backupService.restoreBackup(backup, mode)
      setBackup(undefined)
      await refresh()
      show({ message: 'Backup imported.' })
    }, 'Could not finish importing the backup.'),
    restore: (id: string) => perform(async () => {
      await backupService.restoreSnapshot(id)
      await refresh()
      show({ message: 'Snapshot restored. The previous data is in the safety snapshot.' })
    }, 'Could not restore the snapshot.'),
    removeAll: (confirmation: string) => perform(async () => {
      await backupService.deleteAllData(confirmation)
      window.location.reload()
    }, 'Could not delete your data.'),
  }
}
