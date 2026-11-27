import { z } from '../../shared/db/strictValidation'
import { categoryFields } from './categoryData'
import { applyBulkTaskChange } from './service'
import * as repository from './hierarchyRepository'

const uuid = z.uuid()
const nullableId = uuid.nullable()
const group = z.strictObject({ name: categoryFields.name, color: categoryFields.color })
export const watchGroups = repository.watchGroupRecords
export const saveGroup = (draft: unknown, id?: string, categoryId?: string) =>
  repository.editGroup(group.parse(draft), uuid.optional().parse(id), uuid.optional().parse(categoryId))
export const moveCategoryToGroup = (id: string, groupId: string | null) => repository.assignCategory(uuid.parse(id), nullableId.parse(groupId))
export const ungroup = (id: string) => repository.detachGroup(uuid.parse(id), false)
export const deleteGroup = (id: string) => repository.detachGroup(uuid.parse(id), true)
export const duplicateCategory = (id: string) => repository.copyCategory(uuid.parse(id))
export const deleteCategory = (id: string) => repository.removeCategory(uuid.parse(id), false)
export const deleteCategoryAndTasks = (id: string) => repository.removeCategory(uuid.parse(id), true)
export const restoreCategory = (id: string) => repository.recoverCategory(uuid.parse(id))
export const moveTasksToCategory = (ids: string[], categoryId: string | null) =>
  applyBulkTaskChange(z.array(uuid).min(1).parse(ids).map(id => ({ id })), { kind: 'category', categoryId: nullableId.parse(categoryId) })
export const moveTaskToCategory = (id: string, categoryId: string | null) => moveTasksToCategory([id], categoryId)
