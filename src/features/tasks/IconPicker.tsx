import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { inlineIconSize } from '../../app/uiTokens'
import { Sticker } from '../../shared/ui/Sticker'
import { iconKeys } from '../../assets/stickers/keys'
import type { IconKey } from '../../assets/stickers/keys'
import { iconLabel, TaskIcon } from './icons'
import './organizer.css'

const visible = 4
const last = iconKeys.length - visible

export function IconCarousel({ value, change }: { value: IconKey; change: (icon: IconKey) => void }) {
  const label = useId()
  const track = useRef<HTMLDivElement>(null)
  const [first, setFirst] = useState(() => Math.min(iconKeys.indexOf(value), last))
  function scroll(index: number) {
    const next = Math.max(0, Math.min(index, last))
    const list = track.current
    if (list) list.scrollLeft = next * list.clientWidth / visible
    setFirst(next)
  }

  useEffect(() => {
    const list = track.current
    if (list) list.scrollLeft = Math.min(iconKeys.indexOf(value), last) * list.clientWidth / visible
  }, [value])

  return <div className="organizer-icons">
    <span id={label}>Icon</span>
    <div className="organizer-carousel">
      <button className="icon-button" type="button" aria-label="Previous icons" disabled={first === 0} onClick={() => scroll(first - visible)}>
        <ChevronLeft size={inlineIconSize} aria-hidden /></button>
      <div className="organizer-icon-track" ref={track} role="radiogroup" aria-labelledby={label}
        onScroll={event => { const list = event.currentTarget; if (list.clientWidth) setFirst(Math.round(list.scrollLeft * visible / list.clientWidth)) }}
        onKeyDown={event => {
          const index = iconKeys.indexOf(value)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? iconKeys.length - 1
            : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? Math.min(index + 1, iconKeys.length - 1)
              : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? Math.max(0, index - 1) : -1
          if (next < 0) return
          event.preventDefault()
          change(iconKeys[next])
          scroll(next)
          track.current?.querySelector<HTMLButtonElement>('[data-icon="' + iconKeys[next] + '"]')?.focus()
        }}>
        {iconKeys.map(key => <button key={key} type="button" role="radio" data-icon={key} aria-checked={value === key}
          tabIndex={value === key ? 0 : -1} onClick={() => { change(key); scroll(iconKeys.indexOf(key)) }}>
          <Sticker name={key} size={inlineIconSize} alt="" fallback={<TaskIcon name={key} size={inlineIconSize} />} /><span>{iconLabel(key)}</span>
          {value === key && <Check size={inlineIconSize} aria-hidden />}
        </button>)}
      </div>
      <button className="icon-button" type="button" aria-label="Next icons" disabled={first >= last} onClick={() => scroll(first + visible)}>
        <ChevronRight size={inlineIconSize} aria-hidden /></button>
    </div>
  </div>
}
export const IconPicker = IconCarousel
