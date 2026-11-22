import { z } from 'zod'

const iterations = 600_000
const encoder = new TextEncoder()
const envelope = z.strictObject({
  format: z.literal('tidyberrie-aes-gcm'), version: z.literal(1), iterations: z.literal(iterations),
  salt: z.base64().length(24), iv: z.base64().length(16), payload: z.base64(),
})

function encode(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}

const decode = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0))
const random = (length: number) => crypto.getRandomValues(new Uint8Array(length))

async function material(passphrase: string) {
  return crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey', 'deriveBits'])
}

async function backupKey(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    await material(passphrase), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

const associatedData = encoder.encode('tidyberrie-aes-gcm/v1')

export async function encryptBackup(content: string, password: string) {
  const passphrase = z.string().min(8).max(1024).parse(password)
  const salt = random(16)
  const iv = random(12)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: associatedData },
    await backupKey(passphrase, salt), encoder.encode(content))
  return JSON.stringify({ format: 'tidyberrie-aes-gcm', version: 1, iterations,
    salt: encode(salt), iv: encode(iv), payload: encode(new Uint8Array(cipher)) })
}

export async function decryptBackup(input: unknown, password: string) {
  const { salt, iv, payload } = envelope.parse(input)
  const passphrase = z.string().min(8).max(1024).parse(password)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: associatedData },
    await backupKey(passphrase, decode(salt)), decode(payload))
  return new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
}

export async function pinDigest(pin: string, salt = encode(random(16))) {
  const validated = z.string().regex(/^\d{6,12}$/u).parse(pin)
  const digest = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: decode(salt), iterations },
    await material(validated), 256)
  return { salt, digest: encode(new Uint8Array(digest)) }
}
