import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AppBar } from './AppBar'
import { useKeyboardClearance } from './useKeyboardClearance'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('renders a title, a subpage Back, and optional actions', () => {
  const back = vi.fn()
  const view = render(<AppBar title="More" />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  view.rerender(<AppBar title="Trash" back={back} actions={<button>Restore all</button>} />)
  expect(screen.getByRole('heading', { name: 'Trash' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Restore all' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(back).toHaveBeenCalledOnce()
})

it('marks the shell to hide the FAB when a focused field shrinks the visual viewport', () => {
  const viewport = Object.assign(new EventTarget(), { height: 800, width: 360, offsetTop: 0, scale: 1 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('innerHeight', 800)
  function Fixture() {
    useKeyboardClearance()
    return <input aria-label="Task title" />
  }
  const view = render(<Fixture />)
  screen.getByRole('textbox').focus()
  viewport.height = 520
  viewport.dispatchEvent(new Event('resize'))
  expect(document.documentElement).toHaveAttribute('data-keyboard-open')
  expect(document.documentElement.style.getPropertyValue('--keyboard-offset')).toBe('280px')
  viewport.height = 800
  viewport.dispatchEvent(new Event('resize'))
  expect(document.documentElement).not.toHaveAttribute('data-keyboard-open')
  view.unmount()
  expect(document.documentElement.style.getPropertyValue('--keyboard-offset')).toBe('')
})
