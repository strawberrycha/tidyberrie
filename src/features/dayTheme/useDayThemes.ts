import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../../shared/ui/Toast'
import { choices, themeIndex } from './model'
import type { DayThemeRecord, ThemeFields, ThemeScope } from './model'
import { deleteDayTheme, saveDayTheme, setThemeAssignment, watchDayThemes } from './service'

const empty: DayThemeRecord[] = []

export function useDayThemes(enabled = true) {
  const [state, setState] = useState<{ records?: DayThemeRecord[]; error?: boolean }>()
  const records = state?.records ?? empty
  const index = useMemo(() => themeIndex(records), [records])
  const catalog = useMemo(() => choices(records), [records])
  useEffect(() => enabled ? watchDayThemes(records => setState({ records }), () => setState({ error: true })) : undefined, [enabled])
  return { records, index, catalog, ready: !!state?.records, error: state?.error }
}

export function useDayThemeActions() {
  const show = useToast()
  const [busy, setBusy] = useState(false)
  async function apply(operation: () => Promise<unknown>, message: string, after?: () => void) {
    if (busy) return
    setBusy(true)
    try {
      const undo = await operation()
      show({ message, action: typeof undo === 'function' ? { label: 'Undo', run: async () => { await undo() } } : undefined })
      after?.()
    } catch {
      show({ message: 'Could not save the Day Theme change.' })
    } finally {
      setBusy(false)
    }
  }
  return {
    busy,
    save: (fields: ThemeFields, id: string | undefined, after: () => void) =>
      apply(() => saveDayTheme(fields, id), 'Day Theme saved.', after),
    remove: (id: string, after: () => void) =>
      apply(() => deleteDayTheme(id), 'Day Theme deleted.', after),
    assign: (scope: ThemeScope, key: string) =>
      apply(() => setThemeAssignment(scope, key), key ? 'Day Theme assigned.' : 'Day Theme cleared.'),
  }
}
