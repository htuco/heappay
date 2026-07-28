import { useCallback, useEffect, useState } from 'react'
import { listDependents, listIncomingInvites } from '@/services/familyService'

/**
 * Loads the current user's family relationships: dependents they guard, and
 * any incoming invites where they're the invited dependent. A user can be
 * both at once, so both lists are always loaded together.
 */
export function useFamilyDependents() {
  const [dependents, setDependents] = useState([])
  const [incomingInvites, setIncomingInvites] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const [dependentsData, invitesData] = await Promise.all([
        listDependents(),
        listIncomingInvites(),
      ])
      setDependents(dependentsData)
      setIncomingInvites(invitesData)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { dependents, incomingInvites, isLoading, error, refresh }
}

export default useFamilyDependents
