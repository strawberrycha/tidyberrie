import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { EmptyIllustration } from '../../shared/ui/EmptyState'
import { BudgetCards } from './BudgetCards'
import { budgetEngine } from './engine'
import { defaultCards } from './model'
import { useBudget } from './useBudget'
import './budget.css'

export function HomeBudget({ today }: { today: string }) {
  const { data, error } = useBudget()
  const prefs = data?.preferences
  const cards = prefs?.budgetCards ?? defaultCards
  const values = useMemo(() => data && prefs?.budgetConfigured
    ? budgetEngine(data, today, prefs.budgetView, prefs.budgetHorizon).cards : undefined, [data, prefs, today])
  return <section className="planner-card">
    <h2>Budget</h2>
    {error && <p role="alert">Could not load budget cards.</p>}
    {!error && !data && <p role="status">Loading budget…</p>}
    {values && <BudgetCards home cards={cards} values={values} />}
    {!error && data && !values && <div className="planner-empty"><EmptyIllustration icon={Wallet} sticker="avatar-wallet" /><Link className="secondary" to="/budget">Set up your budget</Link></div>}
    {values && <Link className="secondary planner-date-link" to="/budget">Open Budget</Link>}
  </section>
}
