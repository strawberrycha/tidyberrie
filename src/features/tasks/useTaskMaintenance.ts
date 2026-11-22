import { useEffect } from 'react'
import { useToast } from '../../shared/ui/Toast'
import { purgeTasks } from './service'

export function useTaskMaintenance() {
  const show = useToast()
  useEffect(() => {
    void purgeTasks().catch(() => show({ message: 'Could not clear expired task records.' }))
  }, [show])
}
