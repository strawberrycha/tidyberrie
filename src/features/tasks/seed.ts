import { db, table } from '../../shared/db/database'
import { metadata } from '../../shared/db/repository'
import { saveSchedule } from './scheduleService'
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
  const schedules = table('schedules')
  const schedule = await schedules.filter(row => !row.deletedAt && row.name === 'Development schedule').first()
    ?? await saveSchedule({ name: 'Development schedule', days: [1, 2, 3, 4, 5], color: 'rose', icon: 'check',
      paused: false, startDate: null, endDate: null })
  const records = Array.from({ length: 1000 }, (_, index) => ({
    ...metadata(),
    ...storedTask({ ...emptyTask(addDays(date, (index % 61) - 30)), title: 'Sample task ' + (index + 1),
      priority: priorities[index % priorities.length], pinned: index % 10 === 0,
      ...(index % 4 === 0 ? { scheduleId: schedule.id, allDay: false, startTime: '07:00' } : {}), optional: index % 5 === 0, estimateMinutes: 15 + 15 * (index % 6),
      repeat: { ...defaultRepeat, mode: modes[index % modes.length], interval: 3 },
    }, weekStart),
  }))
  await db.transaction('rw', tasks, sub, async () => {
    await tasks.bulkAdd(records)
    await sub.bulkAdd(records.map(task => ({ ...metadata(), taskId: task.id, title: 'Sample subtask', done: false, order: 0 })))
  })
}
