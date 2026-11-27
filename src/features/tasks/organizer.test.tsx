import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { Check } from 'lucide-react'
import { formatDate, parseTypedDate, parseTypedTime } from '../../shared/utils/dateFormat'
import { DateField, TimeField } from './TypedFields'
import { suggestIcon, useSuggestedIcon } from './suggestIcon'
import { ActionSheet, LongPressHint } from './ActionSheet'
import { ColorSelect } from './ColorSelect'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear() })

it.each([['Monday class', 'calendar'], ['pahinga', 'rest'], ['mag-aral', 'study'], ['trabaho', 'work'],
  ['workout', 'exercise'], ['gising', 'rest'], ['magluto', 'meals'], ['magligo', 'sparkles'],
  ['labada', 'cleaning'], ['dasal', 'heart'], ['sahod', 'budget-day'], ['gamot', 'health'], ['anything else', 'check']])(
  'suggests an icon for %s', (text, icon) => expect(suggestIcon(text)).toBe(icon))

it('keeps a manually chosen icon as a title changes', () => {
  vi.useFakeTimers()
  const { result, rerender } = renderHook(({ title }) => useSuggestedIcon(title), { initialProps: { title: 'Book' } })
  rerender({ title: 'aral' })
  act(() => vi.advanceTimersByTime(300))
  expect(result.current[0]).toBe('study')
  act(() => result.current[1]('star'))
  rerender({ title: 'magluto' })
  act(() => vi.advanceTimersByTime(300))
  expect(result.current[0]).toBe('star')
})

it('formats dates month first and normalizes supported typed times', () => {
  expect(formatDate('2026-11-27', 'long')).toBe('Friday, Nov 27')
  expect(formatDate('2026-11-27', 'numeric')).toBe('11/27/2026')
  expect(formatDate('2026-11-27')).toBe('Nov 27, 2026')
  expect(parseTypedDate('02/29/2026')).toBeUndefined()
  expect(parseTypedDate('02/29/2028')).toBe('2028-02-29')
  expect(['7', '7:30', '730', '7:30 am', '19:30', '00:30'].map(value => parseTypedTime(value, 'AM')))
    .toEqual(['07:00', '07:30', '07:30', '07:30', '19:30', '00:30'])
})

it('masks typed dates, reports errors, and reflects native picker changes', () => {
  function Form() {
    const [date, setDate] = useState('')
    const [time, setTime] = useState('')
    return <><DateField label="Date" value={date} change={setDate} min="2026-11-27" />
      <TimeField label="Time" value={time} change={setTime} /></>
  }
  render(<Form />)
  const date = screen.getByRole('textbox', { name: 'Date' })
  fireEvent.change(date, { target: { value: '11262026' } })
  expect(date).toHaveValue('11/26/2026')
  expect(screen.getByText('Pick today or a later date.')).toBeVisible()
  fireEvent.change(screen.getByLabelText('Date picker'), { target: { value: '2026-12-03' } })
  expect(date).toHaveValue('12/03/2026')
  const time = screen.getByRole('textbox', { name: 'Time' })
  fireEvent.change(time, { target: { value: '730' } })
  fireEvent.blur(time)
  expect(time).toHaveValue('7:30 AM')
  fireEvent.click(screen.getByRole('button', { name: 'PM' }))
  expect(time).toHaveValue('7:30 PM')
  fireEvent.change(screen.getByLabelText('Time picker'), { target: { value: '20:15' } })
  expect(time).toHaveValue('8:15 PM')
})

it('provides named swatches, an action sheet, and a dismissible one-time hint', () => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
  })
  const change = vi.fn()
  const run = vi.fn()
  const { rerender } = render(<ColorSelect value="rose" change={change} />)
  fireEvent.click(screen.getByRole('button', { name: 'Color · Rose' }))
  expect(screen.getByRole('option', { name: 'Rose' })).toHaveAttribute('aria-selected', 'true')
  fireEvent.click(screen.getByRole('option', { name: 'Mint' }))
  expect(change).toHaveBeenCalledWith('mint')
  rerender(<ActionSheet title="Read" close={vi.fn()} actions={[{ label: 'Select', icon: Check, run }]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Select' }))
  expect(run).toHaveBeenCalledOnce()
  rerender(<LongPressHint available />)
  fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
  rerender(<><LongPressHint available key="after" /></>)
  expect(screen.queryByText(/press and hold/)).not.toBeInTheDocument()
})
