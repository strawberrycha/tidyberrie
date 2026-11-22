import { z } from '../../shared/db/strictValidation'
import { themeFields, themeScope } from './model'
import type { ThemeFields, ThemeScope } from './model'
import * as repository from './repository'

export const watchDayThemes = repository.observeThemes
export const saveDayTheme = (fields: ThemeFields, id?: string) =>
  repository.saveDefinition(themeFields.parse(fields), id === undefined ? undefined : z.uuid().parse(id))
export const deleteDayTheme = (id: string) => repository.deleteDefinition(z.uuid().parse(id))
export const setThemeAssignment = (scope: ThemeScope, key: string) =>
  repository.assignTheme(themeScope.parse(scope), z.string().max(40).parse(key))
