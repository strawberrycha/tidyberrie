import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TaskControls, emptyFilters, useTaskSearch } from './TaskControls'
import { showDevelopmentTools } from '../../app/development'

const methods = {
  showModal(this: HTMLDialogElement) { this.setAttribute('open', '') },
  close(this: HTMLDialogElement) { this.removeAttribute('open') },
}
const original = Object.fromEntries(Object.keys(methods).map(name => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]))
beforeEach(() => {
  for (const [name, method] of Object.entries(methods)) Object.defineProperty(HTMLDialogElement.prototype, name, { value: method, configurable: true })
})
afterEach(() => {
  cleanup()
  for (const [name, descriptor] of Object.entries(original)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
  }
  vi.useRealTimers()
})

function Harness() {
  const [filters, apply] = useState(emptyFilters)
  const [query, setQuery] = useState('')
  const delayed = useTaskSearch(query)
  return <><TaskControls list="Today" select={() => {}} filters={filters} apply={apply} query={query} setQuery={setQuery}
    overdue={3} /><output>{delayed}</output></>
}

it('excludes the development seed from production and native builds', () => {
  expect(showDevelopmentTools(false, false)).toBe(false)
  expect(showDevelopmentTools(false, true)).toBe(false)
  expect(showDevelopmentTools(true, true)).toBe(false)
  expect(showDevelopmentTools(true, false)).toBe(true)
})

it('uses one chip row with Done and counts overdue, with Pinned offered only in the filter sheet', () => {
  render(<Harness />)
  const chips = screen.getByRole('navigation', { name: 'Task lists' })
  expect(within(chips).getAllByRole('button').map(chip => chip.textContent)).toEqual(['Today', 'Upcoming', 'Overdue3', 'All', 'Done'])
  expect(screen.queryByText('Pinned only')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
  expect(within(screen.getByRole('dialog')).getByRole('checkbox', { name: 'Pinned only' })).toBeVisible()
})

it('applies a draft filter, reports its count, removes chips, and resets the sheet', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Priority' }), { target: { value: 'high' } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Pinned only' }))
  expect(screen.getByRole('button', { name: 'Filter' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Show results' }))
  expect(screen.getByRole('button', { name: 'Filter, 2 active' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Remove Priority: High' }))
  fireEvent.click(screen.getByRole('button', { name: 'Filter, 1 active' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
  expect(screen.getByRole('checkbox', { name: 'Pinned only' })).not.toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Show results' }))
  expect(screen.getByRole('button', { name: 'Filter' })).toBeVisible()
})

it('opens and focuses search, debounces the query, clears, and closes on Back', () => {
  vi.useFakeTimers()
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  const field = screen.getByRole('searchbox', { name: 'Search tasks' })
  expect(field).toHaveFocus()
  fireEvent.change(field, { target: { value: 'study' } })
  act(() => vi.advanceTimersByTime(199))
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.getByRole('status')).toHaveTextContent('study')
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
  expect(field).toHaveValue('')
  fireEvent.change(field, { target: { value: 'read' } })
  const back = new Event('tidyberrie-back', { cancelable: true })
  fireEvent(document, back)
  expect(back.defaultPrevented).toBe(true)
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByRole('heading', { name: 'Tasks' })).toBeVisible()
})
