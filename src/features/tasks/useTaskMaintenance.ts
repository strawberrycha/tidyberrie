import { useEffect } from 'react'
import { useToast } from '../../shared/ui/Toast'


export function useTaskMaintenance() {
  const show = useToast()
  useEffect(() => {
    void import('./service').then(({ purgeTasks }) => purgeTasks()).catch(() => show({ message: 'Could not clear expired task records.' }))
  }, [show])
}
