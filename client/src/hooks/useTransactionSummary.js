import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import transactionsService from '@/services/transactionsService'
import { subscribeDataChange } from '@/utils/dataEvents'

const DEFAULT_MONTHS = 6

/**
 * Parse "YYYY-MM" into a short month label ("Jan", "Feb", …) without
 * timezone drift. Using `new Date(year, month - 1)` constructs a local date,
 * not a UTC one, so the label is always correct regardless of the user's tz.
 * @param {string} period - "YYYY-MM"
 * @returns {string}
 */
function periodToShortLabel(period) {
  const [year, month] = period.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' })
}

/**
 * Fetch and transform the money-flow summary for the current user.
 *
 * Drop-in compatible with `MoneyFlowPlaceholder` via `chartPoints` / `chartLabels`.
 * When you upgrade the chart to show income vs expense separately, use `chartData`.
 *
 * @param {{ months?: number }} [options]
 * @returns {{
 *   summary: import('@/types/transaction').TransactionSummary | null,
 *   chartData: { label: string, income: number, expense: number, net: number }[],
 *   chartPoints: number[],
 *   chartLabels: string[],
 *   months: number,
 *   setMonths: (n: number) => void,
 *   isLoading: boolean,
 *   error: import('@/types/transaction').TransactionServiceError | null,
 *   refresh: () => void,
 * }}
 */
export function useTransactionSummary({ months: initialMonths = DEFAULT_MONTHS } = {}) {
  const { user, isLoading: authLoading } = useAuth()

  const [months, setMonths] = useState(initialMonths)
  const [summary, setSummary] = useState(null)
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
      setSummary(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    transactionsService
      .getSummary({ months })
      .then((data) => {
        if (!cancelled) setSummary(data)
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

  // API returns newest month first → reverse so the chart reads oldest → newest (left → right).
  const chartData = summary
    ? [...summary.points].reverse().map((p) => ({
        label: periodToShortLabel(p.period),
        income: parseFloat(p.income),
        expense: parseFloat(p.expense),
        net: parseFloat(p.net),
      }))
    : []

  return {
    summary,
    chartData,                          // full per-month objects with income/expense/net
    chartPoints: chartData.map((d) => d.net),    // number[] → MoneyFlowPlaceholder `points`
    chartLabels: chartData.map((d) => d.label),  // string[] → MoneyFlowPlaceholder `labels`
    months,
    setMonths,
    isLoading: authLoading || isLoading,
    error,
    refresh,
  }
}
