import { z } from '../../shared/db/strictValidation'
import { derivePassphraseKey } from '../../shared/db/crypto'
import { parseValue, wireSchema } from './model'
import type { Change, Wire } from './model'

export const profileSchema = z.discriminatedUnion('encrypted', [
  z.strictObject({ version: z.literal(1), encrypted: z.literal(false) }),
  z.strictObject({ version: z.literal(1), encrypted: z.literal(true),
    salt: z.base64().length(24), verifier: z.string().max(128) }),
])
export type Profile = z.infer<typeof profileSchema>
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

function base64(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}

const bytes = (text: string) => Uint8Array.from(atob(text), character => character.charCodeAt(0))

async function seal(key: CryptoKey, context: string, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(context) },
    key, encoder.encode(plaintext))
  return base64(iv) + '.' + base64(new Uint8Array(encrypted))
}

async function open(key: CryptoKey, context: string, cipher: string) {
  const [iv, payload] = z.tuple([z.base64().length(16), z.base64()]).parse(cipher.split('.'))
  return decoder.decode(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes(iv), additionalData: encoder.encode(context) }, key, bytes(payload)))
}

async function derive(passphrase: string, salt: string) {
  return derivePassphraseKey(z.string().min(8).max(1024).parse(passphrase), bytes(salt))
}

export async function newProfile(uid: string, encrypt: boolean, passphrase: string): Promise<Profile> {
  if (!encrypt) return { version: 1, encrypted: false }
  const salt = base64(crypto.getRandomValues(new Uint8Array(16)))
  const key = await derive(passphrase, salt)
  const verifier = await seal(key, 'tidyberrie/sync/v1/' + uid, 'sync-ready')
  return { version: 1, encrypted: true, salt, verifier }
}

export async function unlockProfile(uid: string, profile: Profile, passphrase: string) {
  if (!profile.encrypted) return undefined
  const key = await derive(passphrase, profile.salt)
  if (await open(key, 'tidyberrie/sync/v1/' + uid, profile.verifier) !== 'sync-ready') throw new Error('Invalid passphrase')
  return key
}

function context(uid: string, key: string, wire: Omit<Wire, 'payload'>) {
  return JSON.stringify(['tidyberrie/sync/v1', uid, key, wire.collection, wire.updatedAt, wire.deviceId, wire.deletedAt])
}

export async function encodeChange(uid: string, change: Change, key?: CryptoKey): Promise<Wire> {
  const metadata = { collection: change.collection, updatedAt: change.updatedAt, deletedAt: change.deletedAt,
    deviceId: change.deviceId, encrypted: !!key }
  const content = JSON.stringify(change.value)
  const payload = key ? await seal(key, context(uid, change.key, metadata), content) : content
  if (encoder.encode(payload).byteLength > 131_072) throw new Error('RecordTooLarge')
  return wireSchema.parse({ ...metadata, payload })
}

export async function decodeChange(uid: string, id: string, input: unknown, key?: CryptoKey): Promise<Change> {
  const { payload, encrypted, ...metadata } = wireSchema.parse(input)
  if (encrypted !== !!key) throw new Error('Unexpected encryption mode')
  const content = key ? await open(key, context(uid, id, { ...metadata, encrypted }), payload) : payload
  return { key: id, ...metadata, value: parseValue(metadata.collection, id, metadata, content) }
}
