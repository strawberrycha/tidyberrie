import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { claimBackupNudge } from '../../shared/db/backupService'

function useBackupNudge() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    function check() {
      if (document.visibilityState !== 'visible') return
      void claimBackupNudge().then(due => { if (due) setShow(true) }, () => {})
    }
    check()
    document.addEventListener('visibilitychange', check)
    const timer = window.setInterval(check, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.clearInterval(timer)
    }
  }, [])
  return { show, dismiss: () => setShow(false) }
}

export function BackupNudge() {
  const { show, dismiss } = useBackupNudge()
  return show && <aside className="backup-nudge" aria-label="Backup reminder">
    <p>Back up your data to keep a copy outside this device.</p>
    <div className="actions">
      <Link className="secondary settings-link" to="/settings#backups" onClick={dismiss}>Open Settings</Link>
      <button className="secondary" onClick={dismiss}>Dismiss backup reminder</button>
    </div>
  </aside>
}
