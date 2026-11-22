import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSync } from './useSync'

const labels = {
  loading: 'Checking sync settings…', 'signed-out': 'Signed out', paused: 'Sync is off',
  locked: 'Passphrase needed', ready: 'Sync is on', syncing: 'Syncing…', offline: 'Offline', error: 'Sync needs attention',
}

export function Sync() {
  const sync = useSync()
  const [encrypt, setEncrypt] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const busy = sync.status === 'syncing' || signingIn
  const chooseMode = sync.encrypted === undefined
  const needsPassphrase = sync.encrypted || (chooseMode && encrypt)
  return <section className="settings-card">
    <Link to="/settings" className="secondary settings-link">Back to Settings</Link>
    <p>Sync is optional. Tidyberrie saves your changes on this device, including when you’re offline or signed out.</p>
    {!sync.available ? <p>Cloud sync is unavailable in this build. Use a configured browser or installed PWA to connect.</p> : <>
      <p role="status">{labels[sync.status]}{sync.message ? ' · ' + sync.message : ''}</p>
      <p>{sync.lastSync ? 'Last completed sync: ' + new Date(sync.lastSync).toLocaleString() : 'No completed sync on this device.'}</p>
      {sync.conflicts > 0 && <p role="status">{sync.conflicts} concurrent {sync.conflicts === 1 ? 'change resolved' : 'changes resolved'}. The newest saved revision won.</p>}
      {!sync.signedIn && sync.status !== 'loading' && <button className="primary" disabled={busy} onClick={() => {
        setSigningIn(true)
        void sync.signIn().finally(() => setSigningIn(false))
      }}>Sign in with Google</button>}
      {sync.signedIn && <>
        <p>{sync.encrypted ? 'Cloud payload encryption is on.' : 'Cloud payload encryption is off by default.'} With encryption, Firebase stores unreadable record content, while sync metadata stays visible. A lost passphrase makes encrypted cloud data unrecoverable.</p>
        {(!sync.enabled || sync.status === 'locked') && <form onSubmit={event => {
          event.preventDefault()
          const form = event.currentTarget
          const field = form.elements.namedItem('passphrase')
          const passphrase = field instanceof HTMLInputElement ? field.value : ''
          if (field instanceof HTMLInputElement) field.value = ''
          void sync.enable({ encrypt: needsPassphrase === true, passphrase })
        }}>
          {chooseMode && <label className="sync-checkbox"><input type="checkbox" checked={encrypt} disabled={busy}
            onChange={event => setEncrypt(event.target.checked)} /> Encrypt cloud record contents</label>}
          {needsPassphrase && <label>Sync passphrase (at least eight characters)
            <input name="passphrase" type="password" autoComplete="off" minLength={8} maxLength={1024} required />
          </label>}
          <p>Turning on sync merges supported records on this device with your Google account’s synced copy.</p>
          <button className="primary" disabled={busy}>{sync.enabled ? 'Unlock sync' : 'Turn on sync'}</button>
        </form>}
        <div className="actions">
          {sync.enabled && <>
            <button className="secondary" disabled={busy || sync.status === 'locked'} onClick={() => void sync.syncNow()}>Sync now</button>
            <button className="secondary" onClick={() => void sync.turnOff(false)}>Turn off sync and keep local data</button>
          </>}
          <button className="secondary" onClick={() => void sync.turnOff(true)}>Sign out</button>
        </div>
      </>}
    </>}
  </section>
}
