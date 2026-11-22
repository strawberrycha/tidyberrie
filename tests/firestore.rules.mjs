import { after, before, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

let environment
before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-tidyberrie',
    firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf8') },
  })
  await environment.clearFirestore()
})
after(async () => { await environment?.cleanup() })

const revision = {
  updatedAt: '2026-11-22T00:00:00.000Z', deletedAt: null,
  deviceId: '00000000-0000-4000-8000-000000000001', encrypted: false, payload: '{}',
}
const recordId = 'tasks__0c761920-8935-43f9-a991-140111779588'

test('restricts reads, queries and writes to the owner, and retains tombstones', async () => {
  const owner = environment.authenticatedContext('owner').firestore()
  const other = environment.authenticatedContext('other').firestore()
  const visitor = environment.unauthenticatedContext().firestore()
  const profile = db => doc(db, 'users', 'owner', 'sync', 'profile')
  const path = db => doc(db, 'users', 'owner', 'records', recordId)
  const records = db => query(collection(db, 'users', 'owner', 'records'), limit(20))
  await assertFails(setDoc(profile(other), { version: 1, encrypted: false }))
  await assertSucceeds(setDoc(profile(owner), { version: 1, encrypted: false }))
  await assertFails(updateDoc(profile(owner), { encrypted: true }))
  await assertFails(getDoc(profile(other)))
  await assertFails(setDoc(path(owner), { ...revision, collection: 'tasks', encrypted: true, committedAt: serverTimestamp() }))
  await assertSucceeds(setDoc(path(owner), { ...revision, collection: 'tasks', committedAt: serverTimestamp() }))
  await assertSucceeds(getDoc(path(owner)))
  await assertSucceeds(getDocs(records(owner)))
  await assertFails(getDocs(collection(owner, 'users', 'owner', 'records')))
  await assertFails(getDocs(records(other)))
  await assertFails(getDoc(path(other)))
  await assertFails(getDoc(path(visitor)))
  await assertFails(updateDoc(path(other), { committedAt: serverTimestamp() }))
  await assertFails(updateDoc(path(owner), { payload: 'stale', committedAt: serverTimestamp() }))
  await assertSucceeds(updateDoc(path(owner), {
    deviceId: '00000000-0000-4000-8000-000000000002', committedAt: serverTimestamp(),
  }))
  await assertSucceeds(updateDoc(path(owner), {
    updatedAt: '2026-11-22T00:00:01.000Z', deletedAt: '2026-11-22T00:00:01.000Z', committedAt: serverTimestamp(),
  }))
  await assertFails(deleteDoc(path(owner)))
  await assertFails(setDoc(doc(owner, 'users', 'owner', 'unknown', 'anything'), { value: true }))
})

test('keeps budget history append-only', async () => {
  const owner = environment.authenticatedContext('owner').firestore()
  const entry = doc(owner, 'users', 'owner', 'records', 'budgetHistory__fc761920-8935-43f9-a991-140111779588')
  await assertFails(setDoc(entry, { ...revision, collection: 'budgetHistory', deletedAt: revision.updatedAt, committedAt: serverTimestamp() }))
  await assertSucceeds(setDoc(entry, { ...revision, collection: 'budgetHistory', committedAt: serverTimestamp() }))
  await assertFails(updateDoc(entry, { updatedAt: '2026-11-22T00:00:01.000Z', committedAt: serverTimestamp() }))
  await assertFails(deleteDoc(entry))
})
