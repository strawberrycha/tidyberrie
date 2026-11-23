import { z } from '../../shared/db/strictValidation'
import { scheduleDraft } from './scheduleInput'
import { duplicateScheduleRecord, saveScheduleRecord, setScheduleDeleted, watchScheduleRecords } from './scheduleRepository'

export function saveSchedule(input: unknown, id?: string) {
  return saveScheduleRecord(scheduleDraft.parse(input), id === undefined ? undefined : z.uuid().parse(id))
}

export function duplicateSchedule(id: string, name: unknown, days: unknown) {
  const input = z.strictObject({ name: scheduleDraft.shape.name, days: scheduleDraft.shape.days }).parse({ name, days })
  return duplicateScheduleRecord(z.uuid().parse(id), input.name, input.days)
}

export function deleteSchedule(id: string) { return setScheduleDeleted(z.uuid().parse(id), true) }
export function restoreSchedule(id: string) { return setScheduleDeleted(z.uuid().parse(id), false) }
export const watchSchedules = watchScheduleRecords
