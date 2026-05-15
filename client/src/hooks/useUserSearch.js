import { useEffect, useState } from 'react'
import usersService from '@/services/usersService'
import { getApiErrorMessage } from '@/utils/api'

export function useUserSearch(query, { debounceMs = 250 } = {}) {
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const trimmed = query.trim()

    if (trimmed.length < 3) {
      Promise.resolve().then(() => {
        setResults([])
        setIsLoading(false)
        setError(null)
      })
      return
    }

    let ignore = false
    Promise.resolve().then(() => {
      if (ignore) return
      setIsLoading(true)
      setError(null)
    })

    const timer = setTimeout(async () => {
      try {
        const data = await usersService.search(trimmed)
        if (!ignore) setResults(data)
      } catch (err) {
        if (!ignore) {
          setResults([])
          setError(getApiErrorMessage(err, 'Unable to search users.'))
        }
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }, debounceMs)

    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [debounceMs, query])

  return { results, isLoading, error }
}

export default useUserSearch
