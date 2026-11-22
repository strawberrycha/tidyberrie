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
}
