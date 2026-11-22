import { z } from 'zod'

export const repeatModes = ['once', 'daily', 'weekdays', 'weekends', 'specific', 'weekly', 'monthly', 'yearly', 'custom'] as const
export const repeatSchema = z.strictObject({
  mode: z.enum(repeatModes),
  weekdays: z.array(z.int().min(0).max(6)).max(7),
  interval: z.int().min(1).max(365),
  unit: z.enum(['days', 'weeks', 'months']),
  until: z.union([z.literal(''), z.iso.date()]),
  count: z.int().min(1).max(10000).optional(),
}).superRefine((value, context) => {
  if (value.mode === 'specific' && !value.weekdays.length) {
    context.addIssue({code: 'custom', path: ['weekdays'], message: 'Choose at least one day.'})
  }
  if (value.until && value.count) {
    context.addIssue({code: 'custom', path: ['count'], message: 'Choose an end date or a count.'})
  }
})

export type Repeat = z.infer<typeof repeatSchema>
export const defaultRepeat: Repeat = { mode: 'once', weekdays: [], interval: 1, unit: 'days', until: '' }
export const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
