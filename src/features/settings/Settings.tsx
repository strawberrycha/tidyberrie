import { features } from '../../app/features'
import { DayThemeSettings } from '../dayTheme/DayThemeSettings'
import { useEffect, useState } from 'react'
import { Database, Palette } from 'lucide-react'
import { useTheme } from '../../shared/theme/ThemeProvider'
import { themes } from '../../shared/theme/tokens'
import { useToast } from '../../shared/ui/Toast'

export function Appearance() {
  const { preferences, chooseTheme, chooseWeekStart, chooseAppearance, error } = useTheme()
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
      <form key={preferences?.yourName} onSubmit={event => {
        event.preventDefault()
        const value = new FormData(event.currentTarget).get('name')
        void chooseAppearance({ yourName: value }).catch(() => show({ message: 'Enter a name of up to 40 characters.' }))
      }}>
        <label>Your name<input name="name" required maxLength={40} defaultValue={preferences?.yourName ?? 'Cha'} /></label>
        <button className="secondary" disabled={!preferences}>Save name</button>
      </form>
      <label>Time format<select value={preferences?.timeFormat ?? '12h'} disabled={!preferences} onChange={event => {
        void chooseAppearance({ timeFormat: event.target.value }).catch(() => show({ message: 'Could not save time format.' }))
      }}><option value="12h">12-hour</option><option value="24h">24-hour</option></select></label>
      <label>Text size<select value={preferences?.textSize ?? 100} disabled={!preferences} onChange={event => {
        void chooseAppearance({ textSize: Number(event.target.value) }).catch(() => show({ message: 'Could not save text size.' }))
      }}>{[100, 125, 150, 200].map(size => <option key={size} value={size}>{size}%</option>)}</select></label>
    </section>
    <section className="settings-card">
      <h2><Database size={20} /> Device storage</h2>
      <p>{error ? 'Storage is unavailable.' : !preferences ? 'Checking storage…' : preferences.storagePersistent
        ? 'Persistent storage granted.' : 'Persistent storage was not granted. Keep a backup in case the browser clears local data.'}</p>
    </section>

    {features.dayTheme && <DayThemeSettings />}
  </div>
}
