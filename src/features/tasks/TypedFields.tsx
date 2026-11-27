import { useId, useRef, useState } from 'react'
import { CalendarDays, Clock } from 'lucide-react'
import { inlineIconSize } from '../../app/uiTokens'
import { formatDate, parseTypedDate, parseTypedTime } from '../../shared/utils/dateFormat'
import './organizer.css'

function openPicker(input: HTMLInputElement | null) {
  if (!input) return
  try { if (input.showPicker) { input.showPicker(); return } } catch { /* Older WebViews need focus. */ }
  input.focus()
}

type Field = { label: string; value: string; change: (value: string) => void; min?: string; required?: boolean }
export function DateField({ label, value, change, min, required }: Field) {
  const id = useId()
  const picker = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<{ text: string; accepted: string }>()
  const text = draft?.accepted === value ? draft.text : formatDate(value, 'numeric')
  const date = parseTypedDate(text)
  const error = text && !date ? 'Enter a valid date as MM/DD/YYYY.' : date && min && date < min ? 'Pick today or a later date.' : ''
  return <div>
    <label htmlFor={id}>{label}</label>
    <div className="organizer-field">
      <input id={id} type="text" inputMode="numeric" placeholder="MM/DD/YYYY" value={text} required={required}
        aria-invalid={!!error} aria-describedby={error ? id + '-error' : undefined}
        pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" onChange={event => {
          const digits = event.target.value.replace(/\D/g, '').slice(0, 8)
          const masked = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/')
          const next = parseTypedDate(masked)
          const accepted = next && (!min || next >= min) ? next : ''
          event.target.setCustomValidity(next && min && next < min ? 'Pick today or a later date.' : masked && !next ? 'Enter a valid date as MM/DD/YYYY.' : '')
          setDraft({ text: masked, accepted })
          change(accepted)
        }} />
      <button className="icon-button" type="button" aria-label={'Pick ' + label.toLowerCase()} onClick={() => openPicker(picker.current)}>
        <CalendarDays size={inlineIconSize} aria-hidden /></button>
      <input ref={picker} className="sr-only" tabIndex={-1} aria-label={label + ' picker'} type="date" value={value} min={min}
        onChange={event => { const next = event.target.value; if (!min || next >= min) { setDraft(undefined); change(next) } }} />
    </div>
    {error && <span id={id + '-error'} className="task-error">{error}</span>}
  </div>
}

const periodOf = (value: string) => Number(value.slice(0, 2)) >= 12 ? 'PM' : 'AM'
const displayTime = (value: string) => value ? (Number(value.slice(0, 2)) % 12 || 12) + ':' + value.slice(3) + ' ' + periodOf(value) : ''

export function TimeField({ label, value, change, min, required }: Field) {
  const id = useId()
  const picker = useRef<HTMLInputElement>(null)
  const [manualPeriod, setPeriod] = useState<'AM' | 'PM'>('AM')
  const [draft, setDraft] = useState<{ text: string; accepted: string }>()
  const period = value ? periodOf(value) : manualPeriod
  const text = draft?.accepted === value ? draft.text : displayTime(value)
  const parsed = parseTypedTime(text, period)
  const error = text && !parsed ? 'Enter a valid time.' : parsed && min && parsed < min ? 'That time has already passed.' : ''
  return <div>
    <label htmlFor={id}>{label}</label>
    <div className="organizer-field">
      <input id={id} type="text" value={text} required={required} aria-invalid={!!error} aria-describedby={error ? id + '-error' : undefined}
        onBlur={() => { if (parsed && !error) setDraft(undefined) }}
        onChange={event => {
          const text = event.target.value
          const next = parseTypedTime(text, period)
          const accepted = next && (!min || next >= min) ? next : ''
          event.target.setCustomValidity(text && !accepted ? 'Enter a valid time that has not passed.' : '')
          setDraft({ text, accepted })
          change(accepted)
        }} />
      <button className="icon-button" type="button" aria-label={'Pick ' + label.toLowerCase()} onClick={() => openPicker(picker.current)}>
        <Clock size={inlineIconSize} aria-hidden /></button>
      <input className="sr-only" ref={picker} tabIndex={-1} type="time" aria-label={label + ' picker'} value={value} min={min}
        onChange={event => { const next = event.target.value; if (!min || next >= min) { setDraft(undefined); change(next) } }} />
    </div>
    <div className="task-actions" role="group" aria-label="AM or PM">
      {(['AM', 'PM'] as const).map(part => <button type="button" className="secondary" key={part} aria-pressed={period === part} onClick={() => {
        setPeriod(part)
        const next = parsed && parseTypedTime((Number(parsed.slice(0, 2)) % 12 || 12) + ':' + parsed.slice(3), part)
        if (next && (!min || next >= min)) { setDraft(undefined); change(next) }
      }}>{part}</button>)}
    </div>
    {error && <span id={id + '-error'} className="task-error">{error}</span>}
  </div>
}
