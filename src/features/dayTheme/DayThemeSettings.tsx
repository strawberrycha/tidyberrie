import { useState } from 'react'
import { colorLabels, colors } from '../tasks/input'
import { IconPicker } from '../tasks/IconPicker'
import { TaskDialog } from '../tasks/TaskDialog'
import { localDate } from '../tasks/recurrence'
import { DayThemeBadge } from './DayThemeBadge'
import { themeFields } from './model'
import type { ThemeChoice, ThemeFields } from './model'
import { useDayThemes, useDayThemeActions } from './useDayThemes'
import '../tasks/tasks.css'
import '../calendar/planner.css'

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const defaultFields: ThemeFields = { name: '', color: 'rose', icon: 'sparkles' }

export function assignmentValue(theme?: ThemeChoice) {
  return theme ? theme.key || 'legacy' : ''
}

export function ThemeOptions({ catalog, fallback, current }: { catalog: ThemeChoice[]; fallback: string; current?: ThemeChoice }) {
  return <>
    <option value="">{fallback}</option>
    {current && !current.key && <option value="legacy" disabled>{current.name} (existing assignment)</option>}
    {catalog.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}
  </>
}

export function DayThemeSettings() {
  const themes = useDayThemes()
  const actions = useDayThemeActions()
  const [date, setDate] = useState(localDate)
  const [editor, setEditor] = useState<{ id?: string; fields: ThemeFields }>()
  const [remove, setRemove] = useState<ThemeChoice>()
  const [error, setError] = useState('')
  const custom = themes.catalog.filter(choice => themes.records.some(record => record.catalog && record.id === choice.key))

  return <section className="settings-card wide">
    <h2>Day Themes</h2>
    {themes.error && <p role="alert">Could not load Day Themes.</p>}
    <button type="button" className="secondary" disabled={!themes.ready} onClick={() => {
      setError('')
      setEditor({ fields: defaultFields })
    }}>Add custom theme</button>
    {custom.length > 0 && <ul className="planner-theme-list">{custom.map(theme => <li key={theme.key}>
      <DayThemeBadge theme={theme} />
      <button type="button" className="secondary" aria-label={'Edit ' + theme.name} onClick={() => {
        const { name, color, icon } = theme
        setError('')
        setEditor({ id: theme.key, fields: { name, color, icon } })
      }}>Edit</button>
      <button type="button" className="secondary" aria-label={'Delete ' + theme.name} onClick={() => setRemove(theme)}>Delete</button>
    </li>)}</ul>}
    <details className="planner-settings-detail">
      <summary>Weekday defaults</summary>
      <div className="planner-theme-fields">{weekdays.map((day, weekday) => <label key={day}>
        {day}
        <select value={assignmentValue(themes.index.weekdays.get(weekday))} disabled={!themes.ready || actions.busy}
          onChange={event => void actions.assign({ weekday }, event.target.value)}>
          <ThemeOptions catalog={themes.catalog} fallback="No theme" current={themes.index.weekdays.get(weekday)} />
        </select>
      </label>)}</div>
    </details>
    <details className="planner-settings-detail">
      <summary>Date override</summary>
      <div className="planner-theme-fields">
        <label>Override date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
        <label>Theme for date<select value={assignmentValue(themes.index.dated.get(date))} disabled={!date || !themes.ready || actions.busy}
          onChange={event => void actions.assign({ date }, event.target.value)}>
          <ThemeOptions catalog={themes.catalog} fallback="Use weekday default" current={themes.index.dated.get(date)} />
        </select></label>
      </div>
    </details>
    {editor && <TaskDialog title={editor.id ? 'Edit Day Theme' : 'Add Day Theme'} close={() => setEditor(undefined)}>
      <form noValidate className="task-form" onSubmit={event => {
        event.preventDefault()
        const parsed = themeFields.safeParse(editor.fields)
        if (!parsed.success) { setError(parsed.error.issues[0].message); return }
        void actions.save(parsed.data, editor.id, () => setEditor(undefined))
      }}>
        <label>Name<input data-first-field required maxLength={40} value={editor.fields.name}
          aria-invalid={!!error} aria-describedby={error ? 'day-theme-name-error' : undefined}
          onChange={event => setEditor({ ...editor, fields: { ...editor.fields, name: event.target.value } })} /></label>
        {error && <p className="task-error" id="day-theme-name-error" role="alert">{error}</p>}
        <IconPicker value={editor.fields.icon} change={icon => setEditor({ ...editor, fields: { ...editor.fields, icon } })} />
        <label>Color<select value={editor.fields.color} onChange={event =>
          setEditor({ ...editor, fields: { ...editor.fields, color: event.target.value as ThemeFields['color'] } })}>
          {colors.map((color, index) => <option key={color} value={color}>{colorLabels[index]}</option>)}
        </select></label>
        <button type="submit" className="primary" disabled={actions.busy}>Save theme</button>
      </form>
    </TaskDialog>}
    {remove && <TaskDialog title="Delete Day Theme?" close={() => setRemove(undefined)}>
      <div className="task-form"><p>Delete {remove.name} and its assignments?</p>
        <div className="task-actions">
          <button type="button" className="secondary" data-first-field onClick={() => setRemove(undefined)}>Cancel</button>
          <button type="button" className="primary" disabled={actions.busy} onClick={() =>
            void actions.remove(remove.key, () => setRemove(undefined))}>Delete theme</button>
        </div>
      </div>
    </TaskDialog>}
  </section>
}
