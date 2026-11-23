const edge = 24
const slop = 10
const threshold = 0.4
const flingDistance = 36
const flingSpeed = 0.65
export const holdDelay = 400

export function gestureAllowed(x: number, viewport: number, disabled: boolean) {
  return !disabled && x >= edge && x <= viewport - edge
}

export function gestureAxis(dx: number, dy: number) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < slop) return 'waiting'
  return Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
}

export function swipeAction(dx: number, width: number, elapsed: number) {
  if (Math.abs(dx) < width * threshold &&
    !(Math.abs(dx) >= flingDistance && Math.abs(dx) / Math.max(elapsed, 1) >= flingSpeed)) return
  return dx > 0 ? 'done' : 'reschedule'
}
