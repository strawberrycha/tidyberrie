import { useState } from 'react'
import { useToast } from '../../shared/ui/Toast'
import { archiveExtra, exportCsv, extraSchemas, makeMovement, purchasePreview, saveExtra, validSummaryMonth } from './extraService'
import type { ExtraKind } from './extraRepository'
import type { BudgetData } from './model'

export function useExtraActions() {
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
      show({ message: error instanceof Error && !('issues' in error) ? error.message : 'Check the fields and try again.' })
    } finally {
      setBusy(false)
    }
  }
  return {
    busy, schemas: extraSchemas,
    save: (kind: ExtraKind, value: unknown, id: string | undefined, close: () => void) => run(() => saveExtra(kind, value, id), 'Budget details saved.', close),
    archive: (kind: ExtraKind, id: string, deleted: boolean, close?: () => void) => run(() => archiveExtra(kind, id, deleted), deleted ? 'Moved to Budget extras Trash.' : 'Restored.', close),
    move: (kind: 'goals' | 'debts', value: unknown, close: () => void) =>
      run(() => makeMovement(kind, value), kind === 'goals' ? 'Contribution transferred.' : 'Utang payment saved.', close),
    preview: purchasePreview,
  }
}

export function useTransactionExport() {
  return (data: BudgetData) => {
    const blob = new Blob(['\uFEFF', exportCsv(data)], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'tidyberrie-transactions.csv'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }
}

export function useSummaryMonth(today: string) {
  const [selected, setMonth] = useState<string>()
  return {
    month: (selected ?? today.slice(0, 7)) + '-01',
    select: (value: string) => {
      const valid = validSummaryMonth(value, today)
      if (valid) setMonth(valid)
    },
  }
}
