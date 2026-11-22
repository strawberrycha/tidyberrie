import { initializeApp } from 'firebase/app'
import {
  connectAuthEmulator, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut,
} from 'firebase/auth'
import {
  collection, connectFirestoreEmulator, doc, documentId, getDoc, getDocs,
  getFirestore, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, Timestamp,
} from 'firebase/firestore/lite'
import { z } from '../../shared/db/strictValidation'
import { compare, pageSize } from './model'
import type { Cursor } from './model'
import { profileSchema } from './encryption'
import type { Transport } from './engine'

const emulator = import.meta.env.VITE_SYNC_EMULATOR === 'true'
const configSchema = z.strictObject({
  apiKey: z.string().min(1).max(256),
  projectId: z.string().regex(/^[a-z][a-z0-9-]{3,28}[a-z0-9]$/u),
  appId: z.string().min(1).max(128),
})

export function connectFirebase() {
  const config = configSchema.parse(emulator ? {
    apiKey: 'demo-local-only', projectId: 'demo-tidyberrie', appId: 'demo-local-only',
  } : {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  })
  const app = initializeApp({ ...config, authDomain: config.projectId + '.firebaseapp.com' }, 'tidyberrie-sync')
  const auth = getAuth(app)
  const firestore = getFirestore(app)
  if (emulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
  }

  function transport(uid: string): Transport {
    const profileRef = doc(firestore, 'users', uid, 'sync', 'profile')
    const records = collection(firestore, 'users', uid, 'records')
    return {
      async profile() {
        const snapshot = await getDoc(profileRef)
        return snapshot.exists() ? profileSchema.parse(snapshot.data()) : undefined
      },
      createProfile: profile => runTransaction(firestore, async transaction => {
        const current = await transaction.get(profileRef)
        if (current.exists()) return profileSchema.parse(current.data())
        transaction.set(profileRef, profile)
        return profile
      }),
      async pull(cursor?: Cursor) {
        const sorted = [orderBy('committedAt'), orderBy(documentId())]
        const start = cursor ? [startAfter(new Timestamp(cursor.seconds, cursor.nanoseconds), cursor.id)] : []
        const page = await getDocs(query(records, ...sorted, ...start, limit(pageSize)))
        const last = page.docs.at(-1)
        const time: unknown = last?.get('committedAt')
        if (last && !(time instanceof Timestamp)) throw new Error('Invalid cloud cursor')
        return {
          records: page.docs.map(row => {
            const { committedAt, ...data } = row.data()
            if (!(committedAt instanceof Timestamp)) throw new Error('Invalid cloud record')
            return { id: row.id, data }
          }),
          cursor: last && time instanceof Timestamp ? { seconds: time.seconds, nanoseconds: time.nanoseconds, id: last.id } : undefined,
        }
      },
      push: batch => runTransaction(firestore, async transaction => {
        const refs = batch.map(row => doc(records, row.id))
        const existing = await Promise.all(refs.map(ref => transaction.get(ref)))
        return batch.map((row, index) => {
          const snapshot = existing[index]
          const current = snapshot.data()
          if (current) {
            const { committedAt, ...data } = current
            if (!(committedAt instanceof Timestamp) || typeof data.updatedAt !== 'string' ||
                typeof data.deviceId !== 'string') throw new Error('Invalid cloud record')
            if (row.data.collection === 'budgetHistory' || compare(row.data, {
              updatedAt: data.updatedAt, deviceId: data.deviceId, deletedAt: null,
            }) <= 0) return { id: row.id, data }
          }
          transaction.set(refs[index], { ...row.data, committedAt: serverTimestamp() })
          return row
        })
      }),
    }
  }

  return {
    observe: (change: (uid?: string) => void) => onAuthStateChanged(auth, user => change(user?.uid)),
    signIn: () => signInWithPopup(auth, new GoogleAuthProvider()),
    signOut: () => signOut(auth),
    transport,
  }
}
