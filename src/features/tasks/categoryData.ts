import { z } from '../../shared/db/strictValidation'
import { iconKeys } from '../../assets/stickers/keys'

export const categoryColors = ['rose', 'blush', 'peach', 'berry', 'lavender', 'mint', 'honey', 'sky'] as const
export const statuses = ['todo', 'in_progress', 'done', 'skipped', 'postponed'] as const
export const normalizedStatus = z.union([z.enum(statuses), z.literal('doing')])
  .transform(value => value === 'doing' ? 'in_progress' as const : value)

export const taskFieldDefaults = {
  categoryId: null, optional: false, estimateMinutes: null, actualMinutes: null, originalDate: null, rescheduleCount: 0,
}
export const taskFields = {
  categoryId: z.uuid().nullable().default(null),
  optional: z.boolean().default(false),
  estimateMinutes: z.int().min(1).max(1440).nullable().default(null),
  actualMinutes: z.int().min(0).max(1440).nullable().default(null),
  originalDate: z.iso.date().nullable().default(null),
  rescheduleCount: z.int().nonnegative().default(0),
}

export function normalizeTaskFields(task: Record<string, unknown>) {
  return { ...taskFieldDefaults, ...task, status: normalizedStatus.safeParse(task.status).data ?? 'todo' }
}

export const categoryFields = {
  name: z.string().trim().min(1, 'Enter a category name.').max(30, 'Use at most 30 characters.'),
  color: z.enum(categoryColors), icon: z.enum(iconKeys), order: z.int(), archived: z.boolean(),
}

const presets = [
  ['Sleep', 'lavender', 'rest'], ['Meals', 'peach', 'heart'], ['Hygiene', 'sky', 'self-care'],
  ['Chores', 'mint', 'cleaning'], ['Academics and Learning', 'berry', 'study'], ['Fitness', 'honey', 'health'],
  ['Pageant', 'rose', 'star'], ['Leisure', 'blush', 'leaf'], ['Faith', 'lavender', 'sparkles'],
  ['Events and Others', 'sky', 'celebration'],
] as const

export function defaultCategories(stamp = new Date().toISOString()) {
  return presets.map(([name, color, icon], order) => ({
    id: 'fd7ef237-0a28-46fb-8b80-' + (order + 1).toString().padStart(12, '0'),
    name, color, icon, order, groupId: null, archived: false, createdAt: stamp, updatedAt: stamp, deletedAt: null,
  }))
}
