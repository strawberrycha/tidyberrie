import { expect, it } from 'vitest'
import { gestureAllowed, gestureAxis, swipeAction } from './taskGesture'

it('reserves both Android gesture edges and ignores disabled cards', () => {
  expect(gestureAllowed(23, 360, false)).toBe(false)
  expect(gestureAllowed(337, 360, false)).toBe(false)
  expect(gestureAllowed(24, 360, false)).toBe(true)
  expect(gestureAllowed(336, 360, false)).toBe(true)
  expect(gestureAllowed(180, 360, true)).toBe(false)
})

it('locks horizontally only with horizontal dominance after the slop threshold', () => {
  expect(gestureAxis(8, 7)).toBe('waiting')
  expect(gestureAxis(-14, 5)).toBe('horizontal')
  expect(gestureAxis(12, -16)).toBe('vertical')
})

it('requires sufficient travel or a quick fling and preserves action direction', () => {
  expect(swipeAction(119, 300, 800)).toBeUndefined()
  expect(swipeAction(120, 300, 800)).toBe('done')
  expect(swipeAction(-120, 300, 800)).toBe('reschedule')
  expect(swipeAction(-40, 300, 50)).toBe('reschedule')
  expect(swipeAction(10, 300, 5)).toBeUndefined()
})
