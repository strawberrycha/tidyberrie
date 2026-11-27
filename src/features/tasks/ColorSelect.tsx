import { useId, useState } from 'react'
import { Check } from 'lucide-react'
import { inlineIconSize } from '../../app/uiTokens'
import { colorLabels, colors } from './input'
import { TaskDialog } from './TaskDialog'
import './organizer.css'

type Color = typeof colors[number]
export function ColorSwatch({ color }: { color: Color }) {
  return <span className={'organizer-swatch task-color-' + color} aria-hidden />
}
export function ColorSelect({ value, change }: { value: Color; change: (value: Color) => void }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const label = colorLabels[colors.indexOf(value)]
  return <div>
    <button type="button" className="secondary" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(true)}>
      <ColorSwatch color={value} /> Color · {label}
    </button>
    {open && <TaskDialog title="Choose a color" close={() => setOpen(false)}>
      <div className="task-form" id={id} role="listbox" aria-label="Color"
        onKeyDown={event => {
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
          const index = buttons.indexOf(event.target as HTMLButtonElement)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
            : event.key === 'ArrowDown' ? (index + 1) % buttons.length
              : event.key === 'ArrowUp' ? (index - 1 + buttons.length) % buttons.length : -1
          if (next >= 0) { event.preventDefault(); buttons[next].focus() }
        }}>
        {colors.map((color, index) => <button type="button" className="secondary" role="option" aria-selected={color === value}
          data-first-field={color === value ? true : undefined} key={color} onClick={() => { change(color); setOpen(false) }}>
          <ColorSwatch color={color} /> {colorLabels[index]} {color === value && <Check size={inlineIconSize} aria-hidden />}
        </button>)}
      </div>
    </TaskDialog>}
  </div>
}
