import { describe, expect, it } from 'vitest'
import { addDays, defaultRepeat, encodeRepeat, expandDates, localDate } from './recurrence'
import type { Repeat } from './recurrence'

function dates(options: Partial<Repeat>, start: string, from: string, through: string, weekStart = 1) {
  return expandDates(encodeRepeat({ ...defaultRepeat, ...options }, start, weekStart), start, from, through)
}

describe('plain local-date recurrence', () => {
  it('includes both window boundaries and returns each daily date across daylight saving', () => {
    expect(dates({ mode: 'daily' }, '2026-03-01', '2026-03-07', '2026-03-10'))
      .toEqual(['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'])
    expect(localDate(new Date(2026, 2, 8, 23, 59))).toBe('2026-03-08')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })

  it.each([
    ['weekdays', ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']],
    ['weekends', ['2026-11-01', '2026-11-07']],
    ['specific', ['2026-11-02', '2026-11-05']],
    ['weekly', ['2026-11-01', '2026-11-08']],
  ] as const)('expands %s', (mode, expected) => {
    expect(dates({ mode, weekdays: [1, 4] }, '2026-11-01', '2026-11-01', '2026-11-08'))
      .toEqual(mode === 'weekends' ? [...expected, '2026-11-08'] : expected)
  })

  it.each([
    ['2025-01-29', ['2025-01-29', '2025-03-29']],
    ['2024-01-29', ['2024-01-29', '2024-02-29', '2024-03-29']],
    ['2024-01-30', ['2024-01-30', '2024-03-30']],
    ['2024-01-31', ['2024-01-31', '2024-03-31']],
  ])('skips months without the day in %s', (start, expected) => {
    expect(dates({ mode: 'monthly' }, start, start, start.slice(0, 4) + '-04-01')).toEqual(expected)
  })

  it('repeats leap day only in leap years and supports custom intervals', () => {
    expect(dates({ mode: 'yearly' }, '2024-02-29', '2024-02-29', '2030-03-01')).toEqual(['2024-02-29', '2028-02-29'])
    expect(dates({ mode: 'custom', interval: 3, unit: 'days' }, '2026-01-01', '2026-01-02', '2026-01-07'))
      .toEqual(['2026-01-04', '2026-01-07'])
    expect(dates({ mode: 'custom', interval: 2, unit: 'weeks' }, '2026-01-01', '2026-01-01', '2026-01-16'))
      .toEqual(['2026-01-01', '2026-01-15'])
    expect(dates({ mode: 'custom', interval: 2, unit: 'months' }, '2026-01-01', '2026-01-01', '2026-03-01'))
      .toEqual(['2026-01-01', '2026-03-01'])
  })

  it('honors inclusive end date, occurrence count and configured week start', () => {
    expect(dates({ mode: 'daily', until: '2026-01-03' }, '2026-01-01', '2026-01-02', '2026-01-10'))
      .toEqual(['2026-01-02', '2026-01-03'])
    expect(dates({ mode: 'daily', count: 2 }, '2026-01-01', '2026-01-03', '2026-01-10')).toEqual([])
    expect(encodeRepeat({ ...defaultRepeat, mode: 'weekly' }, '2026-01-01', 0)).toContain('WKST=SU')
    expect(encodeRepeat({ ...defaultRepeat, mode: 'weekly' }, '2026-01-01', 1)).toContain('WKST=MO')
  })

  it('handles unsupported legacy frequency as one date without expanding sub-day occurrences', () => {
    expect(expandDates('FREQ=SECONDLY', '2026-01-01', '2026-01-01', '2026-01-31'))
      .toEqual(['2026-01-01'])
  })
})
