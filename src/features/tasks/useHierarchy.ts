import { useEffect, useState } from 'react'
import type { Records } from '../../shared/db/schemas'
import { watchCategories } from './categoryService'
import { watchGroups } from './hierarchyService'

export type Category = Records['categories']
export type CategoryGroup = Records['groups']
export function useHierarchy(deleted = false) {
  const [categories, setCategories] = useState<Category[]>([])
  const [groups, setGroups] = useState<CategoryGroup[]>([])
  const [error, setError] = useState(false)
  useEffect(() => {
    const failed = () => setError(true)
    const offCategories = watchCategories(setCategories, failed, deleted)
    const offGroups = watchGroups(setGroups, failed)
    return () => { offCategories(); offGroups() }
  }, [deleted])
  return { categories, groups, error }
}
