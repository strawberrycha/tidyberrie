import type { TaskRow } from '../tasks/model'

export function greeting(hour: number) {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

const quotes = [
  'One small promise kept can steady the whole day.', 'Leave a little room for a pleasant surprise.',
  'Start with the task that makes the next one easier.', 'A quiet beginning still counts as a beginning.',
  'Do one thing now that tomorrow will thank you for.', 'A kinder pace can carry you farther.',
  'Your list has room for a breath between lines.', 'Begin wherever your energy can meet you.',
  'There is dignity in doing the ordinary things well.', 'A little preparation is a gift to your future self.',
  'Let the first step be smaller than your worry.', 'Give the next ten minutes a simple purpose.',
  'Today can be meaningful even when it moves slowly.', 'Finish the tiny thing that keeps asking for attention.',
  'Plans can bend and still point somewhere good.', 'Doing less with care can be a full day.',
  'Notice what gets easier each time you return to it.', 'Save some patience for the person doing the work.',
  'Let one clear priority be enough to get started.', 'An ordinary day can hold an excellent little moment.',
  'Give unfinished things a place to wait.', 'Choose a step you can repeat on a tired day.',
  'A pause can help you hear what matters next.', 'Take your time with the things you want to keep.',
  'One helpful action can change the feel of an afternoon.', 'A task done gently is still a task done.',
  'Put the next small step where you can see it.', 'A changed plan can be a thoughtful plan.',
  'You can make room for rest before the list is empty.', 'Give yourself credit for returning to the work.',
  'A clear next step is a good place to stop planning.', 'Choose a pace that leaves energy for the evening.',
  'There is time to begin with what is within reach.', 'A little progress can make a busy day feel lighter.',
  'Pay attention to the small things that went well.', 'Make the useful choice easy to reach.',
  'Give a difficult task one quiet corner of the day.', 'Tidy one thing and let the space welcome you back.',
  'A few focused minutes can be enough to turn a page.', 'Let the work fit the day you actually have.',
  'You can start again without rewriting the whole plan.', 'Take a breath before choosing what comes next.',
  'Some days, leaving space is the most useful plan.', 'Keep the promise small enough to enjoy keeping it.',
  'Do the next kind thing for yourself and move from there.', 'An easy win can give a hard day a better start.',
  'When the list feels loud, choose one quiet action.', 'Give the meaningful things a little of your best time.',
  'Small routines can make room for bigger hopes.', 'Treat a finished task as a moment worth noticing.',
  'Leave the day a little gentler than you found it.', 'Bring curiosity to the thing you have been avoiding.',
  'Plan some effort and save some ease.', 'A few minutes of care can improve what comes after.',
  'Your attention is worth spending thoughtfully.', 'Let a good enough finish free up the next moment.',
  'Begin with a little care and see where it takes you.', 'Honest priorities make a busy list easier to read.',
  'Close one open loop and give yourself a moment.', 'A bit of kindness belongs in every day’s plan.',
]

export function dailyQuote(date: string) {
  const day = Math.floor(Date.parse(date + 'T00:00:00Z') / 86_400_000)
  return quotes[((day % quotes.length) + quotes.length) % quotes.length]
}

export function openPlan(rows: TaskRow[]) {
  return rows.filter(({ value }) => value.status !== 'done').sort((a, b) =>
    Number(b.value.status === 'doing') - Number(a.value.status === 'doing') ||
    (a.value.startTime || '99:99').localeCompare(b.value.startTime || '99:99') ||
    a.value.title.localeCompare(b.value.title))
}

export function relativeTime(time: string, now: Date) {
  if (!time) return 'Any time today'
  const [hours, minutes] = time.split(':').map(Number)
  const delta = hours * 60 + minutes - now.getHours() * 60 - now.getMinutes()
  if (delta === 0) return 'Now'
  const duration = [Math.floor(Math.abs(delta) / 60) ? Math.floor(Math.abs(delta) / 60) + 'h' : '',
    Math.abs(delta) % 60 ? Math.abs(delta) % 60 + 'm' : ''].filter(Boolean).join(' ')
  return delta > 0 ? 'in ' + duration : duration + ' ago'
}
