import { useEffect, useState } from 'react'
import { exportBackup, readBackup, restoreBackup } from '../../shared/db/backupService'
import type { Backup } from '../../shared/db/schemas'
import { useTheme } from '../../shared/theme/ThemeProvider'
import { useToast } from '../../shared/ui/Toast'
import { deleteDemo, loadUndoDemo, restoreDemo } from './service'

export function useSettingsTools() {
  const [backup, setBackup] = useState<Backup>()
  const [demo, setDemo] = useState<Awaited<ReturnType<typeof loadUndoDemo>>>()
  const [busy, setBusy] = useState(false)
  const { refresh } = useTheme()
  const show = useToast()

  useEffect(() => {
    let active = true
    loadUndoDemo().then(
      value => { if (active) setDemo(value) },
      () => { if (active) show({ message: 'Could not open the Undo demo.' }) },
    )
    return () => { active = false }
  }, [show])

  async function download() {
    try {
      const data = await exportBackup()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'tidyberrie-backup.json'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      show({ message: 'Backup exported.' })
    } catch {
      show({ message: 'Could not export your backup.' })
    }
  }

  async function select(file?: File) {
    setBackup(undefined)
    if (!file) return
    setBusy(true)
    try {
      setBackup(await readBackup(file))
    } catch {
      show({ message: 'Choose a valid Tidyberrie JSON backup up to 10 MB.' })
    } finally {
      setBusy(false)
    }
  }

  async function importData(mode: 'merge' | 'replace') {
    if (!backup || busy) return
    setBusy(true)
    try {
      await restoreBackup(backup, mode)
      setBackup(undefined)
      await refresh()
      setDemo(await loadUndoDemo())
      show({ message: 'Backup imported.' })
    } catch {
      show({ message: 'Could not finish importing the backup.' })
    } finally {
      setBusy(false)
    }
  }

  async function restoreItem(id: string) {
    setDemo(await restoreDemo(id))
  }

  async function remove() {
    if (!demo) return
    try {
      const deleted = await deleteDemo(demo.id)
      setDemo(deleted)
      show({ message: 'Sample item moved to Trash.', action: { label: 'Undo', run: () => restoreItem(deleted.id) } })
    } catch {
      show({ message: 'Could not delete the sample item.' })
    }
  }

  return { backup, busy, demo, download, select, importData, remove, restoreItem }
}
