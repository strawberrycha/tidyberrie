import { Wallet } from 'lucide-react'
import { EmptyState } from '../../shared/ui/EmptyState'

export function Budget() {
  return <EmptyState title="Your budget starts here" description="Your peso accounts and spending will appear here." action="Add an account" icon={Wallet} />
}
