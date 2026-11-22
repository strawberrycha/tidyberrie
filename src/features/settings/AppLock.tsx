import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { configureLock, disableLock, getLock, lockDelays, verifyPin } from './lockService'

type LockControls = {
  enabled: boolean; delay: number; configure: (pin: string, delay: number) => Promise<void>;
  disable: () => Promise<void>; lock: () => void
}
const LockContext = createContext<LockControls | null>(null)

export function useAppLock() {
  const lock = useContext(LockContext)
  if (!lock) throw new Error('App Lock provider missing')
  return lock
}

function useLockGate() {
  const state = useLiveQuery(async () => {
    try { return await getLock() } catch { return null }
  }, [])
  const [session, setSession] = useState<string>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const started = useRef<number>(null)
  const locked = state?.enabled && state.version !== session

  useEffect(() => {
    function visibility() {
      if (document.hidden) {
        started.current = Date.now()
      } else if (started.current !== null) {
        if (state?.enabled && Date.now() - started.current >= state.delay * 1000) setSession(undefined)
        started.current = null
      }
    }
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [state])

  async function unlock(pin: string) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await verifyPin(pin)
      if (result.version) setSession(result.version)
      else if (result.retryAt > Date.now()) setError('Too many attempts. Try again in ' + Math.ceil((result.retryAt - Date.now()) / 1000) + ' seconds.')
      else setError('That PIN did not match.')
    } catch {
      setError('Could not verify the PIN. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const controls: LockControls = {
    enabled: state?.enabled ?? false, delay: state?.delay ?? 0,
    configure: async (pin, delay) => setSession(await configureLock(pin, delay, session)),
    disable: async () => { await disableLock(session); setSession(undefined) },
    lock: () => { setError(''); setSession(undefined) },
  }
  return { state, locked, controls, busy, error, unlock }
}

export function AppLock({ children }: { children: ReactNode }) {
  const { state, locked, controls, busy, error, unlock } = useLockGate()
  if (!state) return <main className="lock-screen"><h1>Tidyberrie</h1>
    <p role="status">{state === null ? 'Local App Lock settings are unavailable. Reload to retry.' : 'Loading…'}</p>
  </main>
  return <LockContext.Provider value={controls}>
    <div inert={locked || undefined} hidden={locked || undefined}>{children}</div>
    {locked && <main className="lock-screen">
      <form className="settings-card" onSubmit={event => {
        event.preventDefault()
        const form = event.currentTarget
        const pin = String(new FormData(form).get('pin') ?? '')
        form.reset()
        void unlock(pin)
      }}>
        <h1>Tidyberrie is locked</h1>
        <label>PIN<input type="password" name="pin" autoFocus inputMode="numeric" pattern="[0-9]{6,12}" maxLength={12} required autoComplete="off" /></label>
        <button className="primary" disabled={busy}>Unlock</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>}
  </LockContext.Provider>
}

export function LockSettings() {
  const lock = useAppLock()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const fields = new FormData(form)
    const pin = String(fields.get('newPin') ?? '')
    setBusy(true)
    try {
      if (pin !== fields.get('confirmPin')) { setMessage('The PINs must match.'); return }
      await lock.configure(pin, Number(fields.get('delay')))
      setMessage('App Lock saved.')
    } catch { setMessage('Could not save App Lock.') } finally {
      form.reset()
      setBusy(false)
    }
  }

  return <section className="settings-card wide">
    <h2>App Lock</h2>
    <p>A PIN blocks casual access. It does not encrypt your on-device data. A forgotten PIN cannot be recovered.</p>
    <form key={lock.delay} onSubmit={event => void save(event)}>
      <label>{lock.enabled ? 'New PIN' : 'PIN'} (6–12 digits)<input name="newPin" type="password" inputMode="numeric" pattern="[0-9]{6,12}" maxLength={12} required autoComplete="new-password" /></label>
      <label>Confirm PIN<input name="confirmPin" type="password" inputMode="numeric" pattern="[0-9]{6,12}" maxLength={12} required autoComplete="new-password" /></label>
      <label>Lock when returning after<select name="delay" defaultValue={lock.delay}>
        {lockDelays.map(seconds => <option key={seconds} value={seconds}>{seconds ? (seconds / 60) + ' min' : 'Any time away'}</option>)}
      </select></label>
      <div className="actions">
        <button className="primary" disabled={busy}>Save App Lock</button>
        {lock.enabled && <>
          <button type="button" className="secondary" disabled={busy} onClick={lock.lock}>Lock now</button>
          <button type="button" className="secondary" disabled={busy} onClick={() => {
            setBusy(true)
            void lock.disable().then(() => setMessage('App Lock turned off.'), () => setMessage('Could not turn off App Lock.')).finally(() => setBusy(false))
          }}>Turn off App Lock</button>
        </>}
      </div>
    </form>
    <p role="status">{message}</p>
  </section>
}
