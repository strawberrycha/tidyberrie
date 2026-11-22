import { table } from '../../shared/db/database'
import { Repository } from '../../shared/db/repository'
import { recordSchemas } from '../../shared/db/schemas'
import type { Records } from '../../shared/db/schemas'

const settings = table('settings')
const repository = new Repository(settings, recordSchemas.settings)
export const changeSettings = repository.update.bind(repository)
export const deleteSettings = repository.softDelete.bind(repository)
export const restoreSettings = repository.restore.bind(repository)

type Values = Omit<Records['settings'], 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>

export function findOrCreateSettings(values: Values) {
  return settings.db.transaction('rw', settings, async () =>
    await settings.get({ key: values.key }) ?? repository.create(values))
}
