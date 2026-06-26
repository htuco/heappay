import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import transactionsService from '@/services/transactionsService'
import { subscribeDataChange } from '@/utils/dataEvents'
import {
  CATEGORY_META,
  UNCATEGORISED_META,
} from '@/components/payment/transactionHistory.utils'

const DEFAULT_MONTHS = 6

/**
 * Fetch and transform the spending-by-category breakdown for the current user.
 * Mirrors useTransactionSummary: same auth-gating, data-change subscription, and
 * loading/error contract. The breakdown buckets are joined to CATEGORY_META so
 * each segment carries a display label + color for the chart.
 *
 * @param {{ months?: number }} [options]
 * @returns {{
 *   breakdown: { items: Array<object>, months: number } | null,
 *   segments: Array<{ key: string, name: string, value: number, count: number, color: string }>,
 *   total: number,
 *   months: number,
 *   setMonths: (n: number) => void,
 *   isLoading: boolean,
 *   error: object | null,
 *   refresh: () => void,
 * }}
 */
export function useSpendingByCategory({ months: initialMonths = DEFAULT_MONTHS } = {}) {
  const { user, isLoading: authLoading } = useAuth()

  const [months, setMonths] = useState(initialMonths)
  const [breakdown, setBreakdown] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    return subscribeDataChange(() => {
      refresh()
    })
  }, [refresh])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setBreakdown(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    transactionsService
      .summaryByCategory({ months })
      .then((data) => {
        if (!cancelled) setBreakdown(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, user, months, refreshKey])

  // Join each bucket to its display meta (label + color). The null/Uncategorised
  // bucket falls back to UNCATEGORISED_META. Drop zero-total buckets so the chart
  // doesn't render empty slices.
  const segments = (breakdown?.items ?? [])
    .map((item) => {
      const meta = item.category_id == null ? UNCATEGORISED_META : CATEGORY_META[item.name]
      const resolved = meta ?? { ...UNCATEGORISED_META, label: item.name }
      return {
        key: item.category_id == null ? 'uncategorised' : String(item.category_id),
        name: resolved.label,
        value: Number.parseFloat(item.total) || 0,
        count: item.count,
        color: resolved.color,
      }
    })
    .filter((segment) => segment.value > 0)

  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  return {
    breakdown,
    segments,
    total,
    months,
    setMonths,
    isLoading: authLoading || isLoading,
    error,
    refresh,
  }
}

export default useSpendingByCategory
