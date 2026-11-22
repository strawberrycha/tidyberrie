import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { IconKey } from '../../assets/stickers/keys'
import { iconKeys } from '../../assets/stickers/keys'
import { iconLabel, TaskIcon } from './icons'

export function IconPicker({ value, change }: { value: IconKey; change: (icon: IconKey) => void }) {
  const title = useId()
  const search = useId()
  const [query, setQuery] = useState('')
  const buttons = useRef(new Map<IconKey, HTMLButtonElement>())
  const term = query.trim().toLowerCase()
  const matches = iconKeys.filter(key => key.includes(term) || iconLabel(key).toLowerCase().includes(term))
  const tabTarget = matches.includes(value) ? value : matches[0]

  function move(event: KeyboardEvent<HTMLDivElement>) {
    const from = matches.findIndex(key => buttons.current.get(key) === event.target)
    if (from < 0) return
    const columns = getComputedStyle(event.currentTarget).gridTemplateColumns.trim().split(/\s+/).length
    const shifts: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: -columns, ArrowDown: columns }
    const step = shifts[event.key]
    if (step === undefined && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? matches.length - 1
      : (from + step + matches.length) % matches.length
    const next = matches[index]
    change(next)
    buttons.current.get(next)?.focus()
  }

  return <div className="sticker-picker">
    <span className="sticker-picker-title" id={title}>Icon</span>
    <label htmlFor={search}>Search icons<input id={search} type="search" value={query}
      onChange={event => setQuery(event.target.value)} /></label>
    <div className="sticker-options" role="radiogroup" aria-labelledby={title} onKeyDown={move}>
      {matches.map(key => <button key={key} type="button" role="radio" aria-checked={key === value}
        tabIndex={key === tabTarget ? 0 : -1} onClick={() => change(key)}
        ref={element => { if (element) buttons.current.set(key, element); else buttons.current.delete(key) }}>
        <TaskIcon name={key} size={48} />
        <span>{iconLabel(key)}</span>
      </button>)}
    </div>
    {!matches.length && <p role="status">No matching icons.</p>}
  </div>
}
