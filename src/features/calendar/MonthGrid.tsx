import { useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { TaskIcon } from '../tasks/icons'
import { addDays } from '../tasks/recurrence'
import type { ThemeChoice } from '../dayTheme/model'
import { dateLabel, windowDates } from './dates'
import type { DateWindow } from './dates'
import { emptyDay, summaryText } from './taskWindow'
import type { DaySummary } from './taskWindow'

const shifts: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

export function MonthGrid({ window, anchor, today, days, themeFor, move, open, week }: {
  window: DateWindow; anchor: string; today: string; days: Map<string, DaySummary>; week: boolean;
  themeFor: (date: string) => ThemeChoice | undefined; move: (date: string) => void; open: (date: string) => void
}) {
  const dates = windowDates(window)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const focus = useRef(false)
  useLayoutEffect(() => {
    if (focus.current) buttons.current.get(anchor)?.focus()
    focus.current = false
  }, [anchor])
  function keyDown(event: KeyboardEvent, date: string, column: number) {
    const shift = event.key === 'Home' ? -column : event.key === 'End' ? 6 - column : shifts[event.key]
    if (shift === undefined) return
    event.preventDefault()
    if (!shift) return
    focus.current = true
    move(addDays(date, shift))
  }
  return <div className="calendar-scroll">
    <div role="grid" aria-label={week ? 'Week calendar' : 'Month calendar'} className="calendar-grid">
      <div role="row" className="calendar-grid-row">{dates.slice(0, 7).map(date => <div role="columnheader" key={date}>
        <span aria-label={dateLabel(date, { weekday: 'long' })}>{dateLabel(date, { weekday: 'short' })}</span>
      </div>)}</div>
      {Array.from({ length: dates.length / 7 }, (_, row) => <div role="row" className="calendar-grid-row" key={dates[row * 7]}>
        {dates.slice(row * 7, row * 7 + 7).map((date, column) => {
          const day = days.get(date) ?? emptyDay
          const theme = themeFor(date)
          const number = Number(date.slice(-2))
          const timed = day.rows.filter(row => row.value.startTime).slice(0, week ? 2 : 1)
          return <div role="gridcell" key={date} className="calendar-cell">
            <button type="button" aria-current={date === today ? 'date' : undefined} tabIndex={anchor === date ? 0 : -1}
              className="calendar-date" data-outside={!week && anchor.slice(0, 7) !== date.slice(0, 7)}
              ref={element => { if (element) buttons.current.set(date, element); else buttons.current.delete(date) }}
              onClick={() => { move(date); open(date) }} onKeyDown={event => keyDown(event, date, column)}>
              <span className="calendar-date-top"><b>{number}</b>{theme && <TaskIcon name={theme.icon} size={16} />}</span>
              {day.colors.length > 0 && <span className="calendar-dots" aria-hidden="true">
                {day.colors.map((color, index) => <i key={index} className={'task-color-' + color} />)}
              </span>}
              <span className="calendar-summary">{summaryText(day)}</span>
              {timed.map(row =>
                <time key={row.group.task.id + '/' + (row.occurrence ?? '')}>{row.value.startTime}</time>)}
              <span className="sr-only">{dateLabel(date, { weekday: 'long', month: 'long', year: 'numeric' })}{theme ? ', ' + theme.name : ''}</span>
            </button>
          </div>
        })}
      </div>)}
    </div>
  </div>
}
