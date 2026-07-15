import { useCallback, useEffect, useState } from 'react'
import { listContacts } from '@/services/contactsService'

/**
 * Loads and exposes the current user's contacts. Contact lists are small, so
 * this loads them once and lets the caller filter client-side; call `refresh`
 * after any mutation to re-sync.
 */
export function useContacts() {
  const [contacts, setContacts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await listContacts()
      setContacts(data)
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

  return { contacts, isLoading, error, refresh, setContacts }
}

export default useContacts
