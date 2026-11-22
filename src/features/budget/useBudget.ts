import { useEffect, useState } from 'react'
import { useToast } from '../../shared/ui/Toast'
import { budgetSchemas, configureBudget, purgeBudget, readHistory, saveBudget, seedSample, setCards, setDeleted, setHorizon, settleBudget, watchBudget } from './service'
import type { BudgetTable, Card } from './model'

export function useBudgetHistory(limit: number) {
  const [state, setState] = useState<{ rows?: Awaited<ReturnType<typeof readHistory>>; error?: boolean }>({})
  useEffect(() => {
    let active = true
    readHistory(limit).then(rows => { if (active) setState({ rows }) }, () => { if (active) setState({ error: true }) })
    return () => { active = false }
  }, [limit])
  return state
}

export function useBudget() {
  const [data, setData] = useState<Parameters<Parameters<typeof watchBudget>[0]>[0]>()
  const [error, setError] = useState(false)
  useEffect(() => {
    void purgeBudget().catch(() => setError(true))
    return watchBudget(setData, () => setError(true))
  }, [])
  return { data, error }
}

export function useBudgetActions() {
  const show = useToast()
  const [busy, setBusy] = useState(false)
  async function run(action: () => Promise<void | (() => Promise<void>)>, message: string, after?: () => void) {
    if (busy) return
    setBusy(true)
    try {
      const undo = await action()
      show({ message, action: undo ? { label: 'Undo', run: undo } : undefined })
      after?.()
    } catch (error) {
      show({ message: error instanceof Error && !('issues' in error) ? error.message : 'Check the budget fields and try again.' })
    } finally {
      setBusy(false)
    }
  }
  return {
    busy,
    check: (kind: BudgetTable, value: unknown) => budgetSchemas[kind].safeParse(value),
    save: (kind: BudgetTable, value: unknown, id: string | undefined, week: number, after: () => void) =>
      run(() => saveBudget(kind, value, id, week), 'Budget record saved.', after),
    settle: (kind: 'incomes' | 'expenses', id: string, account: string, occurrence: string | undefined, after: () => void) =>
      run(() => settleBudget(kind, id, account, occurrence), kind === 'incomes' ? 'Income received.' : 'Expense paid.', after),
    remove: (kind: BudgetTable, id: string, deleted: boolean, after?: () => void) =>
      run(() => setDeleted(kind, id, deleted), deleted ? 'Moved to Budget Trash.' : 'Budget record restored.', after),
    configure: (value: string) => run(() => configureBudget(value), 'Budget view saved.'),
    updateCards: (cards: Card[], after: () => void) => run(() => setCards(cards), 'Cards saved.', after),
    horizon: (value: string) => run(() => setHorizon(value), 'Spending horizon saved.'),
    seed: (today: string) => run(() => seedSample(today), '2,000 sample transactions added.'),
  }
}

export type BudgetActions = ReturnType<typeof useBudgetActions>
