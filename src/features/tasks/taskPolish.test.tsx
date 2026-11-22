import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { Tasks } from './Tasks'

const platform = vi.hoisted(() => ({ native: false }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => platform.native } }))
vi.mock('../../shared/theme/ThemeProvider', () => ({ useTheme: () => ({ preferences: { weekStart: 0 } }) }))
vi.mock('./useTasks', () => ({ useTaskGroups: () => ({ groups: [] }), useTaskActions: () => ({ busy: false }) }))

afterEach(() => { cleanup(); vi.unstubAllEnvs(); platform.native = false })
const show = () => render(<MemoryRouter><Tasks /></MemoryRouter>)

it('excludes the seed button in production and in a native development build', () => {
  vi.stubEnv('DEV', false)
  const production = show()
  expect(screen.queryByRole('button', { name: /seed/ })).not.toBeInTheDocument()
  production.unmount()
  vi.stubEnv('DEV', true)
  platform.native = true
  show()
  expect(screen.queryByRole('button', { name: /seed/ })).not.toBeInTheDocument()
})

it('shows concise empty states with an add action only on appropriate lists', () => {
  show()
  const lists = screen.getByRole('navigation', { name: 'Task lists' })
  for (const [chip, copy, add] of [
    ['Today', 'Nothing due today', true], ['Upcoming', 'Nothing coming up', true],
    ['Overdue', 'No overdue tasks. Nice!', false], ['All', 'No tasks yet', true], ['Done', 'Nothing completed yet', false],
  ] as const) {
    fireEvent.click(within(lists).getByRole('button', { name: chip }))
    expect(screen.getByRole('heading', { name: copy })).toBeVisible()
    expect(Boolean(screen.queryByRole('button', { name: 'Add a task' }))).toBe(add)
  }
})
