import { z } from '../../shared/db/strictValidation'
import { iconKeys } from '../../assets/stickers/keys'
import { categoryColors } from './categoryData'

export const scheduleDraft = z.strictObject({
  name: z.string().trim().min(1, 'Enter a schedule name.').max(40, 'Use at most 40 characters.'),
  days: z.array(z.int().min(0).max(6)).min(1, 'Choose at least one day.').max(7)
    .refine(days => new Set(days).size === days.length, 'Choose each day once.'),
  color: z.enum(categoryColors),
  icon: z.enum(iconKeys),
  paused: z.boolean(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
}).refine(value => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
  path: ['endDate'], message: 'End date must be on or after the start date.',
})

export const alarmMode = false

export const scheduledTaskFields = {
  scheduleId: z.uuid().nullable().default(null),
  alertNotify: z.boolean().default(false),
  alertAlarm: z.boolean().default(false),
}
