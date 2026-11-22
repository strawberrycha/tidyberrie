import { z } from '../../shared/db/strictValidation'
import { recordSchemas } from '../../shared/db/schemas'
import type { Records } from '../../shared/db/schemas'

export const collections = [
  'tasks', 'subtasks', 'taskExceptions', 'dayThemes', 'accounts', 'incomes', 'expenses',
  'transfers', 'categoryBudgets', 'goals', 'debts', 'budgetHistory', 'settings',
] as const
export type Collection = typeof collections[number]
export type Value = Records[Collection]
const timestamp = z.iso.datetime({ precision: 3 })
export const revisionSchema = z.strictObject({
  updatedAt: timestamp, deviceId: z.uuid(),
  deletedAt: timestamp.nullable(),
})
export const wireSchema = revisionSchema.extend({
  collection: z.enum(collections), encrypted: z.boolean(),
  payload: z.string().max(131_072),
})
export type Revision = z.infer<typeof revisionSchema>
export type Wire = z.infer<typeof wireSchema>
export type Change = Revision & { key: string; collection: Collection; value: Value | null }
export type Cursor = { seconds: number; nanoseconds: number; id: string }
export const pageSize = 20
export const canonicalTime = (value: string) => new Date(value).toISOString()

export function compare(left: Revision, right: Revision): number {
  return left.updatedAt < right.updatedAt ? -1 : left.updatedAt > right.updatedAt ? 1
    : left.deviceId < right.deviceId ? -1 : left.deviceId > right.deviceId ? 1 : 0
}

export function keyFor(collection: Collection, value: Value) {
  let id = value.id
  if ('key' in value && collection === 'settings') id = value.key
  if ('action' in value && collection === 'taskExceptions') id = value.taskId + '_' + value.date
  if ('seriesId' in value && value.seriesId && collection === 'expenses') id = value.seriesId + '_' + value.date
  if ('weekday' in value && value.weekday !== undefined && collection === 'dayThemes') id = 'weekday_' + value.weekday
  if ('icon' in value && 'date' in value && value.date && collection === 'dayThemes') id = 'date_' + value.date
  return collection + '__' + id
}

export function portable(collection: Collection, value: Value) {
  if (collection === 'settings' && 'key' in value) {
    if (value.key !== 'preferences') return null
    return { ...value, storagePersistent: null }
  }
  return value
}

export function parseValue(collection: Collection, key: string, revision: Revision, content: string): Value | null {
  const parsed: unknown = JSON.parse(content)
  if (parsed === null && revision.deletedAt && collection !== 'budgetHistory') return null
  const value = recordSchemas[collection].parse(parsed)
  if (keyFor(collection, value) !== key || portable(collection, value) === null ||
      (value.deletedAt && canonicalTime(value.deletedAt)) !== revision.deletedAt ||
      (collection === 'budgetHistory' && revision.deletedAt)) throw new Error('Invalid synced record')
  return value
}

export function fingerprint(value: Value | null): string | null {
  if (!value) return null
  return JSON.stringify(value, (_, item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
  })
}
