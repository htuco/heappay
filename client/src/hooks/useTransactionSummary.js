import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import transactionsService from '@/services/transactionsService'
import { subscribeDataChange } from '@/utils/dataEvents'

const DEFAULT_MONTHS = 6

function getUserId(user) {
  return user?.id ?? user?.user_id ?? null
}

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
 * Return the last `n` calendar months as "YYYY-MM" strings, oldest first.
 * @param {number} n
 * @returns {string[]}
 */
function getLastNMonths(n) {
  const now = new Date()
  const result = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    result.push(`${year}-${month}`)
  }
  return result
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
  const userId = getUserId(user)

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
    if (!userId) {
      let cancelled = false
      Promise.resolve().then(() => {
        if (cancelled) return
        setSummary(null)
        setIsLoading(false)
      })
      return () => {
        cancelled = true
      }
    }

    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
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
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, userId, months, refreshKey])

  // Always emit exactly `months` data points (oldest → newest), padding months
  // that have no transactions with zeros so the chart always has full lines.
  const chartData = (() => {
    const periods = getLastNMonths(months)
    const byPeriod = Object.fromEntries(
      (summary?.points ?? []).map((p) => [p.period, p])
    )
    return periods.map((period) => {
      const p = byPeriod[period]
      return {
        label: periodToShortLabel(period),
        income: p ? parseFloat(p.income) : 0,
        expense: p ? parseFloat(p.expense) : 0,
        net: p ? parseFloat(p.net) : 0,
      }
    })
  })()

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
