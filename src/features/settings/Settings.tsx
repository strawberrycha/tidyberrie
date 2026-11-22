import { features } from '../../app/features'
import { useEffect, useState } from 'react'
import { Database, Palette } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DayThemeSettings } from '../dayTheme/DayThemeSettings'
import { useTheme } from '../../shared/theme/ThemeProvider'
import { themes } from '../../shared/theme/tokens'
import { useToast } from '../../shared/ui/Toast'
import { LockSettings } from './AppLock'
import { BackupSettings } from './BackupSettings'

export function Settings() {
  const { preferences, chooseTheme, chooseWeekStart, error } = useTheme()
  const show = useToast()
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
    <BackupSettings />
    <LockSettings />
    {features.dayTheme && <DayThemeSettings />}
    <section className="settings-card wide">
      <h2>Reminders</h2>
      <Link className="secondary settings-link" to="/settings/reminders">Open reminder settings</Link>
    </section>
    {features.tasks && <section className="settings-card wide">
      <h2>Task Trash</h2>
      <Link className="secondary settings-link" to="/tasks?trash">Open task Trash</Link>
    </section>}
  </div>
}
