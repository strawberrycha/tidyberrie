import { useEffect } from 'react'
import { keyboardThreshold } from './uiTokens'

export function useKeyboardClearance() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    let frame = 0
    let baseline = viewport.height
    let width = viewport.width
    function update() {
      cancelAnimationFrame(frame)
      const active = document.activeElement
      const editing = active instanceof HTMLElement && active.matches('input:not([type=checkbox]):not([type=radio]), textarea, [contenteditable=true]')
      const offset = Math.max(0, window.innerHeight - (viewport!.height + viewport!.offsetTop))
      if (!editing || Math.abs(width - viewport!.width) >= keyboardThreshold) baseline = viewport!.height
      width = viewport!.width
      const open = Boolean(editing && viewport!.scale === 1 && Math.max(offset, baseline - viewport!.height) >= keyboardThreshold)
      document.documentElement.toggleAttribute('data-keyboard-open', open)
      document.documentElement.style.setProperty('--keyboard-offset', open ? offset + 'px' : '0px')
      if (open && active instanceof HTMLElement) frame = requestAnimationFrame(() => active.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }))
    }
    viewport.addEventListener('resize', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
      document.documentElement.removeAttribute('data-keyboard-open')
      document.documentElement.style.removeProperty('--keyboard-offset')
    }
  }, [])
}
