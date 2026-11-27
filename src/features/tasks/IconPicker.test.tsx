import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { IconKey } from '../../assets/stickers/keys'
import { IconPicker } from './IconPicker'
import { TaskIcon } from './icons'

vi.mock('../../assets/stickers/manifest.generated', () => ({
  stickerManifest: { study: { small: '/stickers/study-128-test.webp', large: '/stickers/study-256-test.webp' } },
}))
afterEach(cleanup)

it('prefers sticker artwork at illustration size and falls back to Lucide for missing, failed or small art', () => {
  const { rerender } = render(<TaskIcon name="study" label="Study illustration" size={48} />)
  const image = screen.getByRole('img', { name: 'Study illustration' })
  expect(image).toHaveAttribute('width', '48')
  expect(image).toHaveAttribute('height', '48')
  expect(image).toHaveAttribute('loading', 'lazy')
  fireEvent.error(image)
  expect(screen.getByRole('img', { name: 'Study illustration' }).querySelector('svg')).toBeInTheDocument()
  rerender(<TaskIcon name="book" label="Book illustration" size={48} />)
  expect(screen.getByRole('img', { name: 'Book illustration' }).querySelector('svg')).toBeInTheDocument()
  const { container } = render(<TaskIcon name="study" size={22} />)
  expect(container.querySelector('svg')).toBeInTheDocument()
  expect(container.querySelector('img')).toBeNull()
})

it('supports roving focus, selection, arrows and disabled ends', () => {
  function Harness() {
    const [icon, setIcon] = useState<IconKey>('check')
    return <IconPicker value={icon} change={setIcon} />
  }
  render(<Harness />)
  const group = screen.getByRole('radiogroup', { name: 'Icon' })
  const check = within(group).getByRole('radio', { name: 'Check' })
  expect(check).toHaveAttribute('tabindex', '0')
  check.focus()
  fireEvent.keyDown(check, { key: 'ArrowRight' })
  const book = within(group).getByRole('radio', { name: 'Book' })
  expect(book).toHaveFocus()
  expect(book).toHaveAttribute('aria-checked', 'true')
  fireEvent.keyDown(book, { key: 'End' })
  expect(within(group).getByRole('radio', { name: 'Meal' })).toHaveFocus()
  expect(screen.getByRole('button', { name: 'Next icons' })).toBeDisabled()
  fireEvent.keyDown(within(group).getByRole('radio', { name: 'Meal' }), { key: 'Home' })
  expect(screen.getByRole('button', { name: 'Previous icons' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Next icons' }))
  expect(screen.getByRole('button', { name: 'Previous icons' })).toBeEnabled()
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
})
