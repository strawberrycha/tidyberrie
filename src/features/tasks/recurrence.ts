import { RRule } from 'rrule'
import { defaultRepeat } from './repeatInput'
import type { Repeat } from './repeatInput'

export { defaultRepeat, repeatModes, weekdays } from './repeatInput'
export type { Repeat } from './repeatInput'
const ruleDays = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA]
const frequencies = { days: RRule.DAILY, weeks: RRule.WEEKLY, months: RRule.MONTHLY }

const ordinal = (date: string) => new Date(date + 'T00:00:00.000Z')
const key = (date: Date) => date.toISOString().slice(0, 10)
export function addDays(date: string, days: number) {
  const value = ordinal(date)
  value.setUTCDate(value.getUTCDate() + days)
  return key(value)
}

export function localDate(now = new Date()) {
  return [String(now.getFullYear()).padStart(4, '0'), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
}

export function encodeRepeat(repeat: Repeat, date: string, weekStart: number) {
  if (repeat.mode === 'once') return null
  const days = repeat.mode === 'weekdays' ? [1, 2, 3, 4, 5]
    : repeat.mode === 'weekends' ? [0, 6] : repeat.mode === 'specific' ? repeat.weekdays : []
  const freq = repeat.mode === 'custom' ? frequencies[repeat.unit] : repeat.mode === 'daily' ? RRule.DAILY
    : repeat.mode === 'monthly' ? RRule.MONTHLY : repeat.mode === 'yearly' ? RRule.YEARLY : RRule.WEEKLY
  return new RRule({
    dtstart: ordinal(date), freq, wkst: ruleDays[weekStart],
    interval: repeat.mode === 'custom' ? repeat.interval : 1,
    byweekday: days.length ? days.map(day => ruleDays[day]) : undefined,
    until: repeat.until ? ordinal(repeat.until) : undefined,
    count: repeat.count,
  }).toString().split('\n').at(-1)!.replace(/^RRULE:/, '')
}

const ruleFields = {
  FREQ: /^(DAILY|WEEKLY|MONTHLY|YEARLY)$/,
  INTERVAL: /^[1-9][0-9]{0,2}$/,
  WKST: /^(MO|TU|WE|TH|FR|SA|SU)$/,
  BYDAY: /^((MO|TU|WE|TH|FR|SA|SU),){0,6}(MO|TU|WE|TH|FR|SA|SU)$/,
  COUNT: /^[1-9][0-9]{0,4}$/,
  UNTIL: /^[0-9]{8}(T000000Z)?$/,
}

function ruleOptions(rule: string) {
  const fields = rule.replace(/^RRULE:/, '').split(';')
  const seen = new Set<string>()
  for (const field of fields) {
    const [key, value, extra] = field.split('=')
    const match = Object.hasOwn(ruleFields, key) && ruleFields[key as keyof typeof ruleFields]
    if (!match || !value || extra !== undefined || !match.test(value) || seen.has(key)) {
      throw new Error('Unsupported recurrence')
    }
    seen.add(key)
  }
  if (!seen.has('FREQ')) throw new Error('Missing recurrence frequency')
  const options = RRule.parseString(fields.join(';'))
  if ((options.interval ?? 1) > 365 || (options.count ?? 1) > 10000) throw new Error('Unsupported recurrence limit')
  return options
}

function parseRule(rule: string, start: string) {
  return new RRule({ ...ruleOptions(rule), dtstart: ordinal(start) })
}

export function decodeRepeat(rule: string | null): Repeat {
  if (!rule) return defaultRepeat
  try {
    const opts = ruleOptions(rule)
    const interval = opts.interval ?? 1
    const days = rule.match(/(?:^|;)BYDAY=([^;]+)/)?.[1].split(',') ?? []
    const weekdayNumbers = days.map(day => ruleDays.findIndex(value => value.toString() === day)).filter(day => day >= 0)
    const unit = opts.freq === RRule.WEEKLY ? 'weeks' : opts.freq === RRule.MONTHLY ? 'months' : 'days'
    const mode = interval > 1 ? 'custom' : opts.freq === RRule.YEARLY ? 'yearly' : weekdayNumbers.length
      ? weekdayNumbers.length === 5 && weekdayNumbers.every(day => day >= 1 && day <= 5) ? 'weekdays'
        : weekdayNumbers.length === 2 && weekdayNumbers.includes(0) && weekdayNumbers.includes(6) ? 'weekends' : 'specific'
      : unit === 'weeks' ? 'weekly' : unit === 'months' ? 'monthly' : 'daily'
    return { mode, interval, unit, weekdays: weekdayNumbers, until: opts.until ? key(opts.until) : '', count: opts.count ?? undefined }
  } catch {
    return defaultRepeat
  }
}

export function expandDates(rule: string | null, start: string, from: string, through: string) {
  if (from > through || start > through) return []
  if (!rule) return start >= from ? [start] : []
  try {
    return parseRule(rule, start).between(ordinal(from), ordinal(through), true).map(key)
  } catch {
    return start >= from ? [start] : []
  }
}

export function nextOccurrence(rule: string, start: string, after: string, excluded: ReadonlySet<string>) {
  try {
    const recurrence = parseRule(rule, start)
    let date = recurrence.after(ordinal(after), true)
    while (date && excluded.has(key(date))) date = recurrence.after(date)
    return date ? key(date) : undefined
  } catch {
    return undefined
  }
}
