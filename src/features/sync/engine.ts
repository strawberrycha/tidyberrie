import { pageSize } from './model'
import type { Cursor, Wire } from './model'
import { decodeChange, encodeChange } from './encryption'
import type { Profile } from './encryption'
import * as repository from './repository'

export type RemoteRecord = { id: string; data: unknown }
export type Transport = {
  profile: () => Promise<Profile | undefined>
  createProfile: (profile: Profile) => Promise<Profile>
  pull: (cursor?: Cursor) => Promise<{ records: RemoteRecord[]; cursor?: Cursor }>
  push: (records: { id: string; data: Wire }[]) => Promise<RemoteRecord[]>
}

export async function synchronize(uid: string, remote: Transport, key?: CryptoKey) {
  let conflicts = 0
  await repository.capture(uid)
  for (let batch = 0; batch < 50; batch++) {
    const cursor = (await repository.readDevice())?.cursor
    const page = await remote.pull(cursor)
    if (!page.records.length) break
    const decoded = await Promise.all(page.records.map(row => decodeChange(uid, row.id, row.data, key)))
    conflicts += await repository.applyIncoming(uid, decoded, page.cursor)
    if (page.records.length < pageSize) break
    if (batch === 49) return { conflicts, more: true as const }
  }
  for (let batch = 0; batch < 50; batch++) {
    const pending = await repository.pending(uid, pageSize)
    if (!pending.length) return { conflicts, lastSync: await repository.finish(uid), more: false as const }
    const batchData = await Promise.all(pending.map(async change => ({
      id: change.key, data: await encodeChange(uid, change, key),
    })))
    const returned = await remote.push(batchData)
    const decoded = await Promise.all(returned.map(row => decodeChange(uid, row.id, row.data, key)))
    conflicts += await repository.applyIncoming(uid, decoded)
  }
  return { conflicts, more: true as const }
}
