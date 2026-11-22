import { useEffect, useState } from 'react'
import { Database, Palette, RotateCcw, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../shared/theme/ThemeProvider'
import { themes } from '../../shared/theme/tokens'
import { useToast } from '../../shared/ui/Toast'
import { useSettingsTools } from './useSettingsTools'

export function Settings() {
  const { preferences, chooseTheme, chooseWeekStart, error } = useTheme()
  const tools = useSettingsTools()
  const show = useToast()
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [confirmation, setConfirmation] = useState('')
  const [choosing, setChoosing] = useState(false)

  useEffect(() => { if (error) show({ message: 'Local settings could not be loaded.' }) }, [error, show])

  async function change(value: typeof themes[number]) {
    setChoosing(true)
    try {
      await chooseTheme(value)
    } catch {
      show({ message: 'Could not save your theme.' })
    } finally {
      setChoosing(false)
    }
  }

  return <div className="settings-grid">
    <section className="settings-card">
      <h2><Palette size={20} /> Appearance</h2>
      <label htmlFor="theme">Theme</label>
      <select id="theme" disabled={choosing || !preferences} value={preferences?.theme ?? 'strawberry'}
        onChange={event => void change(event.target.value === 'sakura' ? 'sakura' : 'strawberry')}>
        <option value="strawberry">Strawberry Milk</option>
        <option value="sakura">Sakura Night</option>
      </select>
      <label htmlFor="week-start">Week starts on</label>
      <select id="week-start" disabled={choosing || !preferences} value={preferences?.weekStart ?? 1}
        onChange={event => {
          setChoosing(true)
          void chooseWeekStart(Number(event.target.value)).catch(() => show({ message: 'Could not save the week start.' }))
            .finally(() => setChoosing(false))
        }}>
        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) =>
          <option key={day} value={index}>{day}</option>)}
      </select>
    </section>
    <section className="settings-card">
      <h2><Database size={20} /> Device storage</h2>
      <p>{error ? 'Storage is unavailable.' : !preferences ? 'Checking storage…' : preferences.storagePersistent
        ? 'Persistent storage granted.' : 'Persistent storage was not granted. Keep a backup in case the browser clears local data.'}</p>
    </section>
    <section className="settings-card wide">
      <h2><Upload size={20} /> Backups</h2>
      <p>Download a JSON copy or import a backup up to 10 MB. Tidyberrie keeps the latest seven daily snapshots on this device.</p>
      <div className="actions">
        <button type="button" className="primary" disabled={tools.busy} onClick={() => void tools.download()}>Export JSON</button>
        <label className="file-label">
          Import JSON
          <input type="file" accept=".json,application/json" disabled={tools.busy} onChange={event => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            setConfirmation('')
            void tools.select(file)
          }} />
        </label>
      </div>
      {tools.backup && <fieldset>
        <legend>Import options</legend>
        <label htmlFor="import-mode">How to import</label>
        <select id="import-mode" disabled={tools.busy} value={mode} onChange={event => {
          setMode(event.target.value === 'replace' ? 'replace' : 'merge')
          setConfirmation('')
        }}>
          <option value="merge">Merge with local data</option>
          <option value="replace">Replace all local data</option>
        </select>
        {mode === 'replace' ? <label htmlFor="confirmation">Type REPLACE to confirm deleting existing local data.
          <input id="confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} />
        </label> : <p>Matching records will use the imported copy.</p>}
        <button type="button" className="secondary" disabled={tools.busy || (mode === 'replace' && confirmation !== 'REPLACE')}
          onClick={() => void tools.importData(mode)}>Confirm import</button>
      </fieldset>}
    </section>
    <section className="settings-card wide">
      <h2><RotateCcw size={20} /> Undo demo</h2>
      <p>{tools.demo?.deletedAt ? 'The sample item is in Trash.' : 'Try deleting and restoring a sample item.'}</p>
      {tools.demo?.deletedAt
        ? <button type="button" className="secondary" onClick={() => {
          const id = tools.demo?.id
          if (id) void tools.restoreItem(id).then(() => show({ message: 'Restored.' }), () => show({ message: 'Could not restore the item.' }))
        }}>Restore sample</button>
        : <button type="button" className="secondary" disabled={!tools.demo} onClick={() => void tools.remove()}>Delete sample</button>}
    </section>
    <section className="settings-card wide">
      <h2>Task Trash</h2>
      <Link className="secondary" to="/tasks?trash">Open task Trash</Link>
    </section>
  </div>
}
