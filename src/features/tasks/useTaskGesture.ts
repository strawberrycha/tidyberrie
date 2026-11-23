import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { gestureAllowed, gestureAxis, holdDelay, swipeAction } from './taskGesture'

export function useTaskGesture(options: {
  disabled: boolean; select?: () => void; swipe?: (action: 'done' | 'reschedule') => void
}) {
  const [drag, setDrag] = useState(0)
  const gesture = useRef<{ id: number; x: number; y: number; at: number; axis: ReturnType<typeof gestureAxis>; width: number } | undefined>(undefined)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const suppress = useRef(false)
  useEffect(() => () => clearTimeout(timer.current), [])
  function reset() { clearTimeout(timer.current); gesture.current = undefined; setDrag(0) }
  return {
    drag,
    onPointerDown(event: PointerEvent<HTMLElement>) {
      suppress.current = false
      if (gesture.current || event.pointerType === 'mouse' || event.button !== 0 ||
        (event.target as Element).closest('button, input, a, summary') ||
        !gestureAllowed(event.clientX, window.innerWidth, options.disabled)) return
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp,
        axis: 'waiting', width: event.currentTarget.getBoundingClientRect().width }
      if (options.select) timer.current = setTimeout(() => {
        suppress.current = true
        gesture.current = undefined
        navigator.vibrate?.(10)
        options.select?.()
      }, holdDelay)
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const start = gesture.current
      if (!start || start.id !== event.pointerId) return
      const x = event.clientX - start.x
      if (start.axis === 'waiting') {
        start.axis = gestureAxis(x, event.clientY - start.y)
        if (start.axis !== 'waiting') clearTimeout(timer.current)
        if (start.axis === 'horizontal') event.currentTarget.setPointerCapture?.(event.pointerId)
      }
      if (start.axis === 'horizontal' && options.swipe) {
        suppress.current = true
        setDrag(Math.max(-start.width, Math.min(start.width, x)))
      }
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const start = gesture.current
      if (!start || start.id !== event.pointerId) return
      reset()
      if (start.axis !== 'horizontal' || options.disabled) return
      const action = swipeAction(event.clientX - start.x, start.width, event.timeStamp - start.at)
      if (action) options.swipe?.(action)
    },
    onPointerCancel: reset,
    onLostPointerCapture: reset,
    onPointerLeave() {
      if (gesture.current?.axis !== 'horizontal') reset()
    },
    consumeClick() { const prevented = suppress.current; suppress.current = false; return prevented },
  }
}
