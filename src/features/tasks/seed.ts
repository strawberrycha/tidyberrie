import { db, table } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import { saveCategory } from './categoryService'
import { saveGroup, moveCategoryToGroup } from './hierarchyService'
import { emptyTask, priorities } from './input'
import { storedTask } from './model'
import { addDays, defaultRepeat, localDate } from './recurrence'
import type { Repeat } from './recurrence'

export async function seedTasks(weekStart: number) {
  if (!import.meta.env.DEV) return
  const tasks = table('tasks')
  const sub = table('subtasks')
  const date = localDate()
  const modes: Repeat['mode'][] = ['once', 'daily', 'weekdays', 'weekends', 'weekly', 'monthly', 'yearly', 'custom']
  const groups = table('groups')
  const categories = table('categories')
  const groupName = 'Development group'
  const categoryName = 'Development category'
  const findGroup = () => groups.filter(row => !row.deletedAt && row.name === groupName).first()
  const findCategory = () => categories.filter(row => !row.deletedAt && row.name === categoryName).first()
  if (!await findGroup()) await saveGroup({ name: groupName, color: 'rose' })
  if (!await findCategory()) await saveCategory({ name: categoryName, color: 'rose', icon: 'check' })
  const group = (await findGroup())!
  const category = (await findCategory())!
  if (category.groupId !== group.id) await moveCategoryToGroup(category.id, group.id)
  const records = Array.from({ length: 1000 }, (_, index) => ({
    ...metadata(),
    ...storedTask({ ...emptyTask(addDays(date, (index % 61) - 30)), title: 'Sample task ' + (index + 1),
      priority: priorities[index % priorities.length], pinned: index % 10 === 0,
      ...(index % 4 === 0 ? { categoryId: category.id, allDay: false, startTime: '07:00' } : {}), optional: index % 5 === 0, estimateMinutes: 15 + 15 * (index % 6),
      repeat: { ...defaultRepeat, mode: modes[index % modes.length], interval: 3 },
    }, weekStart),
  }))
  await db.transaction('rw', tasks, sub, async () => {
    await tasks.bulkAdd(records)
    await sub.bulkAdd(records.map(task => ({ ...metadata(), taskId: task.id, title: 'Sample subtask', done: false, order: 0 })))
  })
}
