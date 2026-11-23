import { z } from '../../shared/db/strictValidation'
import { inTaskTransaction } from './repository'
import { emptyTask, newSubtask } from './input'
import { localDate } from './recurrence'
import { saveTask } from './service'
import { scheduleDraft } from './scheduleInput'
import { duplicateScheduleRecord, reorderSchedule, reorderScheduleTask, saveScheduleRecord, setScheduleDeleted, watchScheduleRecords } from './scheduleRepository'

export function saveSchedule(input: unknown, id?: string) {
  return saveScheduleRecord(scheduleDraft.parse(input), id === undefined ? undefined : z.uuid().parse(id))
}

export function duplicateSchedule(id: string, name: unknown, days: unknown) {
  const input = z.strictObject({ name: scheduleDraft.shape.name, days: scheduleDraft.shape.days }).parse({ name, days })
  return duplicateScheduleRecord(z.uuid().parse(id), input.name, input.days)
}

export function deleteSchedule(id: string) { return setScheduleDeleted(z.uuid().parse(id), true) }
export function restoreSchedule(id: string) { return setScheduleDeleted(z.uuid().parse(id), false) }
export function createExampleSchedule() {
  return inTaskTransaction(async () => {
    const schedule = await saveSchedule({ name: 'Monday (example)', days: [1], color: 'rose', icon: 'check',
      paused: false, startDate: null, endDate: null })
    for (const [title, startTime] of [['Wake up', '07:00'], ['Tidy up bed', '07:15'], ['Brush teeth', '07:30']]) {
      await saveTask({ ...emptyTask(localDate()), title, startTime, allDay: false, scheduleId: schedule.id,
        subtasks: title === 'Brush teeth' ? ['Brush', 'Floss', 'Rinse'].map(name => ({ ...newSubtask(), title: name })) : [] }, 0)
    }
    return () => deleteSchedule(schedule.id).then(() => undefined)
  })
}

export const moveSchedule = (id: string, offset: number) => reorderSchedule(z.uuid().parse(id), z.literal([-1, 1]).parse(offset))
export const moveScheduleTask = (scheduleId: string, taskId: string, offset: number) =>
  reorderScheduleTask(z.uuid().parse(scheduleId), z.uuid().parse(taskId), z.literal([-1, 1]).parse(offset))
export const watchSchedules = watchScheduleRecords
