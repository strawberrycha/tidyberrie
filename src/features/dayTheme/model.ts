import { z } from 'zod'
import { colors, icons } from '../tasks/input'
import type { Records } from '../../shared/db/schemas'

export const themeFields = z.strictObject({
  name: z.string().trim().min(1, 'Enter a theme name.').max(40),
  color: z.enum(colors),
  icon: z.enum(icons),
})
export const themeScope = z.union([
  z.strictObject({ date: z.iso.date() }),
  z.strictObject({ weekday: z.int().min(0).max(6) }),
])

export type ThemeFields = z.infer<typeof themeFields>
export type ThemeScope = z.infer<typeof themeScope>
export type DayThemeRecord = Records['dayThemes']
export type ThemeChoice = ThemeFields & { key: string }

function preset(key: string, name: string, icon: ThemeFields['icon'], color: ThemeFields['color']): ThemeChoice {
  return { key, name, icon, color }
}

export const presets = [
  preset('study', 'Study', 'book', 'lavender'), preset('work', 'Work', 'briefcase', 'sky'),
  preset('deep-work', 'Deep Work', 'star', 'berry'), preset('rest', 'Rest', 'leaf', 'mint'),
  preset('self-care', 'Self-care', 'heart', 'rose'), preset('health', 'Health', 'heart', 'mint'),
  preset('errands', 'Errands', 'check', 'honey'), preset('travel', 'Travel', 'briefcase', 'sky'),
  preset('celebration', 'Celebration', 'sparkles', 'blush'), preset('journal', 'Journal', 'book', 'peach'),
  preset('goals', 'Goals', 'star', 'lavender'), preset('cleaning', 'Cleaning', 'home', 'mint'),
  preset('budget-day', 'Budget Day', 'briefcase', 'honey'),
]

export function choices(records: DayThemeRecord[]): ThemeChoice[] {
  return [...presets, ...records.flatMap(record => {
    const value = themeFields.safeParse({ name: record.name, color: record.color, icon: record.icon })
    return record.catalog && !record.deletedAt && value.success ? [{ ...value.data, key: record.id }] : []
  })]
}

export function themeIndex(records: DayThemeRecord[]) {
  const catalog = new Map(choices(records).map(item => [item.key, item]))
  const dated = new Map<string, ThemeChoice>()
  const weekdays = new Map<number, ThemeChoice>()
  const assignments = records.filter(record => !record.deletedAt && !record.catalog)
    .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt) || a.id.localeCompare(b.id))
  for (const record of assignments) {
    const choice = record.themeKey ? catalog.get(record.themeKey) : {
      key: '', name: record.name,
      icon: icons.find(icon => icon === record.icon) ?? 'sparkles',
      color: colors.find(color => color === record.color) ?? 'rose',
    } satisfies ThemeChoice
    if (!choice) continue
    if (record.date) dated.set(record.date, choice)
    else if (record.weekday !== undefined) weekdays.set(record.weekday, choice)
  }
  return { dated, weekdays }
}

export function resolveDayTheme(index: ReturnType<typeof themeIndex>, date: string, weekday: number) {
  return index.dated.get(date) ?? index.weekdays.get(weekday)
}
