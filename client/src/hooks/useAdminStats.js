import { useCallback, useEffect, useState } from 'react'
import transactionsService from '@/services/transactionsService'

/**
 * Platform-wide stats for the admin overview: transaction trends/breakdowns
 * plus refund request counts. Both calls are staff/admin-gated server-side.
 */
export function useAdminStats({ months = 6 } = {}) {
  const [txStats, setTxStats] = useState(null)
  const [requestStats, setRequestStats] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [tx, requests] = await Promise.all([
          transactionsService.getTransactionStats({ months }),
          transactionsService.getRequestStats(),
        ])
        if (!cancelled) {
          setTxStats(tx)
          setRequestStats(requests)
        }
      } catch (err) {
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [months, refreshKey])

  return { txStats, requestStats, isLoading, error, refresh }
}
