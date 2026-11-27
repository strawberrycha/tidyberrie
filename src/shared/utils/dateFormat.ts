export function formatDate(value: string, style: 'numeric' | 'long' | 'short' = 'short') {
  if (!value) return ''
  const [year, month, day] = value.slice(0, 10).split('-')
  if (style === 'numeric') return month + '/' + day + '/' + year
  return monthFirstDate(value, style === 'long'
    ? { weekday: 'long', month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' })
}

export function monthFirstDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', options).format(new Date(value.slice(0, 10) + 'T12:00:00'))
}

export function parseTypedDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match || match[3] === '0000') return
  const date = match[3] + '-' + match[1] + '-' + match[2]
  const parsed = new Date(date + 'T12:00:00Z')
  if (Number.isFinite(+parsed) && parsed.toISOString().startsWith(date)) return date
}

export function parseTypedTime(value: string, period: 'AM' | 'PM') {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim())
  if (match && Number(match[1]) > 12 && Number(match[1]) < 24 && Number(match[2]) < 60) return match[1] + ':' + match[2]
  const parts = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/i.exec(value.trim())
  if (!parts) return
  const hour = Number(parts[1])
  const minute = Number(parts[2] ?? 0)
  if (hour < 1 || hour > 12 || minute > 59) return
  const pm = (parts[3]?.toUpperCase() ?? period) === 'PM'
  return String(hour % 12 + (pm ? 12 : 0)).padStart(2, '0') + ':' + String(minute).padStart(2, '0')
}
