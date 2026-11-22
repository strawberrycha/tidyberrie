import type Dexie from 'dexie'

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
}
