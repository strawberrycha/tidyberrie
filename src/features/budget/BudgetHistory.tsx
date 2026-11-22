import { useState } from 'react'
import { kinds } from './model'
import { useBudgetHistory } from './useBudget'

export function BudgetHistory() {
  const [limit, setLimit] = useState(25)
  const { rows, error } = useBudgetHistory(limit)
  if (error) return <p role="alert">Could not load budget history.</p>
  if (!rows) return <p role="status">Loading budget history…</p>
  return <div className="budget-history">
    {!rows.length && <p>No budget changes yet.</p>}
    {rows.map(entry => <details key={entry.id}>
      <summary>{kinds[entry.entityType as keyof typeof kinds] ?? entry.entityType} · {entry.field} · {new Date(entry.changedAt).toLocaleString()}</summary>
      <p>Record {entry.entityId}</p>
      <p>Previous</p><pre>{JSON.stringify(entry.oldValue, null, 2)}</pre>
      <p>New</p><pre>{JSON.stringify(entry.newValue, null, 2)}</pre>
    </details>)}
    {rows.length >= limit && limit < 10000 && <button type="button" className="secondary" onClick={() => setLimit(limit + 25)}>Show more history</button>}
  </div>
}
