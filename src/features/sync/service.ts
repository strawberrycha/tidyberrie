import { z } from '../../shared/db/strictValidation'
import { newProfile, unlockProfile } from './encryption'
import type { Profile } from './encryption'
import { synchronize } from './engine'
import * as repository from './repository'

type Firebase = ReturnType<typeof import('./firebase').connectFirebase>
type Status = 'loading' | 'signed-out' | 'paused' | 'locked' | 'ready' | 'syncing' | 'offline' | 'error'
type View = {
  status: Status; signedIn: boolean; enabled: boolean; encrypted?: boolean; lastSync?: string;
  conflicts: number; message?: string
}

const listeners = new Set<() => void>()
let view: View = { status: 'loading', signedIn: false, enabled: false, conflicts: 0 }
let firebase: Firebase | undefined
let connecting: Promise<void> | undefined
let uid: string | undefined
let key: CryptoKey | undefined
let profile: Profile | undefined
let work: Promise<void> | undefined
let epoch = 0

export const getSnapshot = () => view
export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function publish(patch: Partial<View>) {
  view = { ...view, ...patch }
  for (const listener of listeners) listener()
}

async function accountChanged(next?: string) {
  const current = ++epoch
  uid = next
  profile = undefined
  key = undefined
  const device = await repository.readDevice()
  if (epoch !== current) return
  const enabled = !!next && device?.uid === next && device.enabled
  publish({
    enabled, signedIn: !!next, status: next ? 'paused' : 'signed-out', encrypted: undefined,
    lastSync: device?.lastSync, conflicts: 0, message: undefined,
  })
  if (next && device && next !== device.uid) {
    publish({ message: 'This browser is linked to a different sync account. Sign out and use the original account or a separate browser profile.' })
    return
  }
  if (next && navigator.onLine) {
    try {
      const saved = await firebase?.transport(next).profile()
      if (epoch !== current) return
      profile = saved
      publish({ encrypted: saved?.encrypted })
    } catch {
      if (epoch !== current) return
    }
  }
  if (enabled) await syncNow()
}

export function connect() {
  if (connecting) return connecting
  connecting = import('./firebase').then(module => {
    firebase = module.connectFirebase()
    firebase.observe(next => {
      void accountChanged(next).catch(() => publish({ status: 'error', message: 'Could not read local sync settings.' }))
    })
  }).catch(() => {
    connecting = undefined
    publish({ status: 'error', message: 'Could not initialize Firebase. Check the app configuration.' })
  })
  return connecting
}

export async function resumeEnabled() {
  if ((await repository.readDevice())?.enabled) await connect()
}

export async function signIn() {
  if (!firebase) { await connect(); return }
  try {
    await firebase.signIn()
  } catch {
    publish({ message: 'Google sign-in did not finish. Allow the popup and try again.' })
  }
}

export async function turnOff(signOut: boolean) {
  const current = ++epoch
  key = undefined
  try {
    await repository.disableDevice()
    if (signOut) await firebase?.signOut()
    if (epoch === current) publish({ enabled: false, status: uid ? 'paused' : 'signed-out', message: 'Sync is off. Your device data is still available.' })
  } catch {
    if (epoch === current) publish({ status: 'error', message: 'Could not finish turning off sync. Try again.' })
  }
}

const preferences = z.strictObject({ encrypt: z.boolean(), passphrase: z.string().max(1024) })

export async function enable(input: unknown) {
  const account = uid
  const current = epoch
  if (!account || !firebase || !navigator.onLine || work) return
  const captured = firebase
  publish({ status: 'syncing', message: undefined })
  try {
    const options = preferences.parse(input)
    const device = await repository.readDevice()
    if (device && device.uid !== account) {
      publish({ status: 'paused', message: 'This browser is linked to a different sync account. Use the original account or a separate browser profile.' })
      return
    }
    const remote = captured.transport(account)
    let saved = await remote.profile()
    if (!saved) saved = await remote.createProfile(await newProfile(account, options.encrypt, options.passphrase))
    if (options.encrypt && !saved.encrypted) {
      if (current === epoch) publish({ status: 'paused', encrypted: false, message: 'This account already uses unencrypted sync. Review that setting before enabling.' })
      return
    }
    if (current !== epoch) return
    publish({ encrypted: saved.encrypted })
    const unlocked = await unlockProfile(account, saved, options.passphrase)
    if (current !== epoch) return
    await repository.enableDevice(account)
    if (current !== epoch) return
    profile = saved
    key = unlocked
    publish({ enabled: true, encrypted: saved.encrypted, status: 'ready' })
    await syncNow()
  } catch {
    if (current === epoch) publish({
      status: view.enabled ? 'locked' : 'paused',
      message: 'Could not enable or unlock sync. Check your connection and passphrase.',
    })
  }
}

export function syncNow() {
  if (work) return work
  const account = uid
  const current = epoch
  const client = firebase
  if (!account || !client || !view.enabled) return Promise.resolve()
  if (!navigator.onLine) {
    publish({ status: 'offline', message: 'Offline. Changes are still saved on this device.' })
    return Promise.resolve()
  }
  work = (async () => {
    try {
      const remote = client.transport(account)
      const saved = profile ?? await remote.profile()
      if (epoch !== current) return
      if (!saved) {
        publish({ status: 'paused', message: 'Reconnect sync from Settings to create the cloud profile.' })
        return
      }
      profile = saved
      if (saved.encrypted && !key) {
        publish({ status: 'locked', encrypted: true, message: 'Enter the sync passphrase to continue.' })
        return
      }
      publish({ status: 'syncing', message: undefined })
      const result = await synchronize(account, remote, key)
      if (epoch !== current) return
      publish({
        status: 'ready', conflicts: view.conflicts + result.conflicts,
        lastSync: result.more ? view.lastSync : result.lastSync,
        message: result.more ? 'More changes are queued. The next sync will continue.' : undefined,
      })
    } catch (error) {
      if (epoch !== current) return
      publish({ status: navigator.onLine ? 'error' : 'offline',
        message: error instanceof Error && error.message === 'RecordTooLarge'
          ? 'A record exceeds the sync size limit. Shorten it or remove it before retrying.'
          : 'Sync could not finish. Your local data is still available. Try again when connected.',
      })
    } finally {
      if (epoch === current) {
        window.dispatchEvent(new Event('tidyberrie-sync-updated'))
        window.dispatchEvent(new Event('tidyberrie-reminder-refresh'))
      }
    }
  })().finally(() => { work = undefined })
  return work
}
