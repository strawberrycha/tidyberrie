import { z } from '../../shared/db/strictValidation'
import { categoryFields } from './categoryData'
import * as repository from './categoryRepository'

const draft = z.strictObject({ name: categoryFields.name, color: categoryFields.color, icon: categoryFields.icon })
const uuid = z.uuid()
const normalizeName = (name: string) => name.trim().toLowerCase()
export const watchCategories = repository.watchCategories
export const watchLastCategory = repository.watchLastCategory

export function saveCategory(input: unknown, id?: string) {
  const value = draft.parse(input)
  if (id !== undefined) uuid.parse(id)
  return repository.changeCategory(id, (current, all) => {
    if (all.some(item => item.id !== id && !item.deletedAt
      && normalizeName(item.name) === normalizeName(value.name))) throw new Error('A category already uses that name.')
    return { ...value, groupId: current?.groupId ?? null, archived: current?.archived ?? false, order: current?.order ?? Math.max(-1, ...all.map(item => item.order)) + 1 }
  })
}

export function archiveCategory(id: string, archived: boolean) {
  return repository.changeCategory(uuid.parse(id), (current, all) => {
    if (!current) throw new Error('Category is unavailable.')
    if (!z.boolean().parse(archived) && all.some(item => item.id !== id && !item.deletedAt && !item.archived
      && normalizeName(item.name) === normalizeName(current.name))) throw new Error('A category already uses that name.')
    return { name: current.name, color: current.color, icon: current.icon, order: current.order, groupId: current.groupId, archived }
  })
}

export function moveCategory(id: string, direction: number) {
  return repository.reorderCategory(uuid.parse(id), z.literal([-1, 1]).parse(direction))
}
