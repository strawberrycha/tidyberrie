import { convertScheduleRecords } from './categoryMigration'
import type Dexie from 'dexie'
import { defaultCategories, normalizeTaskFields } from '../../features/tasks/categoryData'

export function registerMigrations(db: Dexie) {
  db.version(1).stores({
    tasks: 'id,startAt,endAt,status,deletedAt',
    subtasks: 'id,taskId,dueAt,deletedAt',
    taskExceptions: 'id,taskId,date,[taskId+date],deletedAt',
    dayThemes: 'id,weekday,date,deletedAt',
    accounts: 'id,type,deletedAt',
    incomes: 'id,expectedDate,status,accountId,deletedAt',
    expenses: 'id,date,status,accountId,deletedAt',
    budgetHistory: 'id,entityId,changedAt,deletedAt',
    settings: 'id,&key,deletedAt',
    snapshots: 'id,&day,deletedAt',
  })
  db.version(2).stores({
    taskExceptions: 'id,taskId,date,[taskId+date],movedTo,deletedAt',
  })
  db.version(3).stores({ dayThemes: 'id,weekday,date,themeKey,deletedAt' })
  db.version(4).stores({ reminderDevice: 'id,&key,sourceAt' })
  db.version(5).stores({
    transfers: 'id,date,fromAccountId,toAccountId,deletedAt',
    expenses: 'id,date,status,accountId,deletedAt,seriesId,&[seriesId+date]',
  })
  db.version(6).stores({
    categoryBudgets: 'id,categoryKey,deletedAt',
    goals: 'id,accountId,deletedAt',
    debts: 'id,dueDate,deletedAt',
    transfers: 'id,date,fromAccountId,toAccountId,deletedAt,debtId',
    incomes: 'id,expectedDate,status,accountId,deletedAt,debtId',
    expenses: 'id,date,status,accountId,deletedAt,seriesId,&[seriesId+date],debtId',
  })
  db.version(7).stores({ recoveryDevice: 'id', lockDevice: 'id' })
  db.version(8).stores({ syncDevice: 'id', syncRecords: 'key, pending' })
  db.version(9).stores({
    categories: 'id,order,deletedAt',
    tasks: 'id,startAt,endAt,status,deletedAt,categoryId',
  }).upgrade(async tx => {
    await tx.table('tasks').toCollection().modify(task => { Object.assign(task, normalizeTaskFields(task)) })
    await tx.table('taskExceptions').toCollection().modify(exception => {
      if (exception.override) exception.override = normalizeTaskFields(exception.override)
    })
    if (!await tx.table('categories').count()) await tx.table('categories').bulkAdd(defaultCategories())
  })
  db.version(10).stores({
    schedules: 'id,order,deletedAt',
    tasks: 'id,startAt,endAt,status,deletedAt,categoryId,scheduleId',
  }).upgrade(async tx => {
    await tx.table('tasks').toCollection().modify(task => {
      task.scheduleId = null
      task.alertNotify = (task.reminders?.length ?? 0) > 0
      task.alertAlarm = false
    })
  })
  db.version(11).stores({ groups: 'id,order,deletedAt', categories: 'id,order,deletedAt,groupId' })
    .upgrade(convertScheduleRecords)
}
