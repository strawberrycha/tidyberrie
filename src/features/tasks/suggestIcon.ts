import { useEffect, useState } from 'react'
import type { IconKey } from '../../assets/stickers/keys'

const rules: [RegExp, IconKey][] = [
  [/monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miyerkules|huwebes|biyernes|sabado|linggo|week|daily/i, 'calendar'],
  [/leisure|rest|relax|chill|pahinga/i, 'rest'],
  [/school|study|class|acads|review|aral/i, 'study'],
  [/exercise|gym|workout|\brun|fitness/i, 'exercise'],
  [/work|office|job|trabaho/i, 'work'],
  [/sleep|tulog|bed|wake|gising/i, 'rest'],
  [/meal|food|\beat|lunch|dinner|breakfast|kain|luto/i, 'meals'],
  [/hygiene|shower|ligo|brush|teeth|skin/i, 'sparkles'],
  [/chores|clean|laundry|labada|linis/i, 'cleaning'],
  [/faith|church|simba|pray|dasal/i, 'heart'],
  [/budget|money|bills|pera|sahod|allowance/i, 'budget-day'],
  [/pageant|ramp|practice|q&a/i, 'star'],
  [/health|doctor|medicine|gamot/i, 'health'],
  [/travel|trip/i, 'travel'],
  [/shop|grocery|errands/i, 'errands'],
  [/event|party|celebrat/i, 'celebration'],
  [/journal|notes/i, 'journal'],
  [/goals/i, 'goals'],
]
export const suggestIcon = (text: string): IconKey => rules.find(([pattern]) => pattern.test(text))?.[1] ?? 'check'

export function useSuggestedIcon(text: string, initial?: IconKey) {
  const [selected, pick] = useState(initial)
  const [suggested, setSuggested] = useState(() => suggestIcon(text))
  useEffect(() => {
    if (selected) return
    const timer = setTimeout(() => setSuggested(suggestIcon(text)), 300)
    return () => clearTimeout(timer)
  }, [selected, text])
  return [selected ?? suggested, pick] as const
}
