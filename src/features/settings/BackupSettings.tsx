import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useSettingsTools } from './useSettingsTools'

function Counts({ counts }: { counts: { name: string; count: number }[] }) {
  return <ul>{counts.map(({ name, count }) => <li key={name}>{name.replace(/([a-z])([A-Z])/g, '$1 $2')}: {count}</li>)}</ul>
}

export function BackupSettings() {
  const tools = useSettingsTools()
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [confirmation, setConfirmation] = useState('')
  const [deletion, setDeletion] = useState('')
  const [snapshotId, setSnapshotId] = useState('')
  const passphrase = useRef<HTMLInputElement>(null)
  const restoreDialog = useRef<HTMLDialogElement>(null)
  const deleteDialog = useRef<HTMLDialogElement>(null)
  const snapshots = tools.overview ? [
    ...(tools.overview.safety ? [{ ...tools.overview.safety, label: 'Safety snapshot' }] : []),
    ...tools.overview.snapshots.map(snap => ({ ...snap, label: snap.day })),
  ] : []

  function takePassphrase() {
    const value = passphrase.current?.value ?? ''
    if (passphrase.current) passphrase.current.value = ''
    return value
  }

  return <section id="backups" className="settings-card wide">
    <h2><Upload size={20} aria-hidden="true" /> Backups</h2>
    <p>{tools.overview?.exportedAt ? 'Last backup export: ' + new Date(tools.overview.exportedAt).toLocaleDateString('en-US') : 'No backup export recorded on this device.'}</p>
    <p>Keep a restorable JSON copy somewhere safe. CSV is for reading your data in a spreadsheet. A forgotten encrypted backup passphrase cannot be recovered.</p>
    <label>Passphrase for encrypted import or export
      <input ref={passphrase} type="password" autoComplete="off" maxLength={1024} aria-describedby="backup-passphrase-help" />
    </label>
    <p id="backup-passphrase-help">Use at least eight characters. Enter your passphrase before choosing an encrypted file.</p>
    <div className="actions">
      <button className="primary" disabled={tools.busy} onClick={() => void tools.download('json', '')}>Export JSON</button>
      <button className="secondary" disabled={tools.busy} onClick={() => void tools.download('encrypted', takePassphrase())}>Export encrypted JSON</button>
      <button className="secondary" disabled={tools.busy} onClick={() => void tools.download('csv', '')}>Export CSV</button>
    </div>
    <label>Import JSON
      <input className="backup-file" type="file" accept=".json,application/json" disabled={tools.busy} onChange={event => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        setConfirmation('')
        if (file) void tools.select(file, takePassphrase())
      }} />
    </label>
    {tools.backup && <fieldset>
      <legend>Import preview</legend>
      <p>Incoming records include items in Trash. No changes have been made.</p>
      <Counts counts={tools.importCounts} />
      <p>Daily snapshots: {tools.backup.data.snapshots.length}</p>
      <label>How to import<select value={mode} disabled={tools.busy} onChange={event => {
        setMode(event.target.value === 'replace' ? 'replace' : 'merge')
        setConfirmation('')
      }}>
        <option value="merge">Merge with local data</option>
        <option value="replace">Replace all local data</option>
      </select></label>
      {mode === 'replace' ? <label>Type REPLACE to replace local records and daily snapshots
        <input value={confirmation} onChange={event => setConfirmation(event.target.value)} />
      </label> : <p>Matching records will use the imported copy.</p>}
      <button className="secondary" disabled={tools.busy || (mode === 'replace' && confirmation !== 'REPLACE')}
        onClick={() => void tools.importData(mode)}>Confirm import</button>
    </fieldset>}
    <h3>Device snapshots</h3>
    <p>Up to seven daily snapshots and one safety snapshot. Restoring saves your current records to the safety snapshot first.</p>
    {tools.overview === undefined && <p role="status">Loading snapshots…</p>}
    {tools.overview === null && <p role="alert">Could not load snapshots.</p>}
    {tools.overview && !snapshots.length && <p>No snapshots yet.</p>}
    {snapshots.map(snapshot => <details key={snapshot.id}>
      <summary>{snapshot.label} · {new Date(snapshot.createdAt).toLocaleString()}</summary>
      <Counts counts={snapshot.counts} />
      <button className="secondary" disabled={tools.busy} onClick={() => {
        setSnapshotId(snapshot.id)
        restoreDialog.current?.showModal()
      }}>Restore {snapshot.label}</button>
    </details>)}
    <button className="secondary" disabled={tools.busy} onClick={() => {
      setDeletion('')
      deleteDialog.current?.showModal()
    }}>Delete all data</button>
    <dialog ref={restoreDialog} className="settings-card" aria-labelledby="restore-title">
      <h3 id="restore-title">Restore this snapshot?</h3>
      <p>Current records will be replaced. You can recover them from the new safety snapshot.</p>
      <div className="actions">
        <button className="secondary" onClick={() => restoreDialog.current?.close()}>Cancel</button>
        <button className="primary" onClick={() => {
          restoreDialog.current?.close()
          void tools.restore(snapshotId)
        }}>Confirm restore</button>
      </div>
    </dialog>
    <dialog ref={deleteDialog} className="settings-card" aria-labelledby="delete-data-title">
      <h3 id="delete-data-title">Delete all data?</h3>
      <p>This permanently removes records, Trash, app settings, and snapshots from this device.</p>
      <button className="secondary" disabled={tools.busy} onClick={() => void tools.download('json', '')}>Export JSON first</button>
      <label>Type DELETE to confirm<input value={deletion} onChange={event => setDeletion(event.target.value)} /></label>
      <div className="actions">
        <button className="secondary" onClick={() => deleteDialog.current?.close()}>Cancel</button>
        <button className="primary" disabled={tools.busy || deletion !== 'DELETE'} onClick={() => void tools.removeAll(deletion)}>Permanently delete data</button>
      </div>
    </dialog>
  </section>
}
