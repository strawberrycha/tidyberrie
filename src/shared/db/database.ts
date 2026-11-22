import Dexie from 'dexie'
import type { Records } from './schemas'
import { registerMigrations } from './migrations'

export function openDatabase(name = 'tidyberrie') {
  const db = new Dexie(name)
  registerMigrations(db)
  return db
}

export const db = openDatabase()

export function table<K extends keyof Records>(name: K, database = db) {
  return database.table<Records[K], string>(name)
}
