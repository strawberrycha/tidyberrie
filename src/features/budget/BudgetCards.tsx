import { useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { colors, colorLabels } from '../tasks/input'
import { TaskDialog } from '../tasks/TaskDialog'
import { formatMoney } from './engine'
import { cardDefinitions } from './model'
import type { Card } from './model'

export function Amount({ value }: { value: bigint | number | null }) {
  if (value === null) return <span>Open-ended</span>
  return <span className="budget-amount">
    {formatMoney(value)}
    {value < 0n && <span className="budget-negative"><CircleAlert size={18} aria-hidden /> Negative</span>}
  </span>
}

export function BudgetCards({ cards, values, home = false }: {
  cards: Card[]; values: Record<Card['key'], bigint | null>; home?: boolean
}) {
  const [about, setAbout] = useState<Card>()
  return <div className="budget-cards">
    {cards.filter(card => home ? card.home : card.visible).map(card =>
      <article className={'planner-card budget-card task-color-' + card.color} data-featured={card.key === 'leftMonth'} key={card.key}>
        <h3>{card.label}</h3>
        <Amount value={values[card.key]} />
        <button className="secondary" type="button" aria-label={'How it’s calculated: ' + card.label} onClick={() => setAbout(card)}>How it’s calculated</button>
      </article>)}
    {about && <TaskDialog title={about.label} close={() => setAbout(undefined)}>
      <p>{cardDefinitions[about.key].explanation}</p>
    </TaskDialog>}
  </div>
}

export function CardEditor({ initial, busy, save, close }: {
  initial: Card[]; busy: boolean; save: (cards: Card[]) => void; close: () => void
}) {
  const [cards, setCards] = useState(initial)
  const change = (index: number, value: Partial<Card>) => setCards(cards.map((card, position) => position === index ? { ...card, ...value } : card))
  const reorder = (index: number, next: number) => {
    const copy = [...cards]
    const original = copy.splice(index, 1)[0]
    copy.splice(next, 0, original)
    setCards(copy)
  }
  return <TaskDialog title="Customize budget cards" close={close}>
    <form className="task-form" onSubmit={event => { event.preventDefault(); save(cards) }}>
      {cards.map((card, index) => <fieldset className="budget-card-options" key={card.key}>
        <legend>{cardDefinitions[card.key].label}</legend>
        <label>Label<input required value={card.label} maxLength={40} onChange={event => change(index, { label: event.target.value })} /></label>
        <label>Color<select value={card.color} onChange={event => change(index, { color: event.target.value as Card['color'] })}>
          {colors.map((color, position) => <option value={color} key={color}>{colorLabels[position]}</option>)}
        </select></label>
        <label className="task-check"><input type="checkbox" checked={card.visible} onChange={event => change(index, { visible: event.target.checked })} /> Show on Budget</label>
        <label className="task-check"><input type="checkbox" checked={card.home} onChange={event => change(index, { home: event.target.checked })} /> Show on Home</label>
        <div className="task-actions">
          <button className="secondary" type="button" disabled={index === 0} aria-label={'Move ' + card.label + ' up'} onClick={() => reorder(index, index - 1)}>Move up</button>
          <button className="secondary" type="button" disabled={index === cards.length - 1} aria-label={'Move ' + card.label + ' down'} onClick={() => reorder(index, index + 1)}>Move down</button>
        </div>
      </fieldset>)}
      <button className="primary" type="submit" disabled={busy}>Save cards</button>
    </form>
  </TaskDialog>
}
