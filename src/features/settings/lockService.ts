import { z } from 'zod'
import { pinDigest } from '../../shared/db/crypto'
import { readLock, updateLock } from './lockRepository'

export const lockDelays = [0, 60, 300, 900] as const
export const getLock = async () => {
  const lock = await readLock()
  return lock ? { enabled: true, delay: lock.delay, version: lock.salt, retryAt: lock.retryAt } : { enabled: false, delay: 0 }
}

export async function configureLock(pin: string, delay: number, authorizedVersion?: string) {
  const seconds = z.literal(lockDelays).parse(delay)
  const verifier = await pinDigest(pin)
  await updateLock(current => {
    if (current && current.salt !== authorizedVersion) throw new Error('Unlock first')
    return { id: 'lock', ...verifier, delay: seconds, failures: 0, retryAt: 0 }
  })
  return verifier.salt
}

export async function verifyPin(pin: string) {
  const current = await readLock()
  if (!current) return { version: undefined, retryAt: 0 }
  if (current.retryAt > Date.now()) return { retryAt: current.retryAt }
  const candidate = await pinDigest(pin, current.salt)
  let difference = 0
  for (let index = 0; index < candidate.digest.length; index++) {
    difference |= candidate.digest.charCodeAt(index) ^ current.digest.charCodeAt(index)
  }
  const updated = await updateLock(latest => {
    if (latest?.salt !== current.salt || latest.retryAt > Date.now()) throw new Error('Lock changed. Try again.')
    if (difference === 0) return { ...latest, failures: 0, retryAt: 0 }
    const failures = latest.failures + 1
    const wait = failures < 3 ? 0 : Math.min(300, 5 * 2 ** (failures - 3))
    return { ...latest, failures, retryAt: wait ? Date.now() + wait * 1000 : 0 }
  })
  return { version: difference === 0 ? current.salt : undefined, retryAt: updated?.retryAt ?? 0 }
}

export function disableLock(version?: string) {
  return updateLock(current => {
    if (current && current.salt !== version) throw new Error('Unlock first')
    return undefined
  })
}
