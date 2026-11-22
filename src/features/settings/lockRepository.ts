import { db } from '../../shared/db/database'

export type AppLockRecord = {
  id: 'lock'; salt: string; digest: string; delay: number; failures: number; retryAt: number
}
const locks = db.table<AppLockRecord, string>('lockDevice')

export const readLock = () => locks.get('lock')

export function updateLock(update: (current: AppLockRecord | undefined) => AppLockRecord | undefined) {
  return db.transaction('rw', locks, async () => {
    const next = update(await readLock())
    if (next) await locks.put(next)
    else await locks.delete('lock')
    return next
  })
}
