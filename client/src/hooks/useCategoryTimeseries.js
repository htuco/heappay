import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import transactionsService from '@/services/transactionsService'
import { subscribeDataChange } from '@/utils/dataEvents'
import {
  CATEGORY_META,
  UNCATEGORISED_META,
} from '@/components/payment/transactionHistory.utils'

const DEFAULT_RANGE = '90d'

/**
 * Parse "YYYY-MM" into a local Date (no timezone drift — `new Date(y, m-1)`
 * builds a local date, so the month never shifts by one under a UTC parse).
 * @param {string} period
 */
function periodToDate(period) {
  const [year, month] = period.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

/**
 * Short axis label for a "YYYY-MM" period. When the axis spans more than one
 * calendar year, disambiguate with a 2-digit year ("Jan '26") so repeated month
 * names across years don't collide.
 * @param {string} period
 * @param {boolean} withYear
 */
function periodToLabel(period, withYear) {
  const d = periodToDate(period)
  const month = d.toLocaleString('en-US', { month: 'short' })
  if (!withYear) return month
  return `${month} '${String(d.getFullYear()).slice(-2)}`
}

/**
 * Fetch and transform the month-on-month spend-by-category time series for the
 * current user. Mirrors useSpendingByCategory's contract (auth-gating,
 * data-change subscription, loading/error), but adds a `range` control using
 * the shared '7d'|'30d'|'90d'|'1y' vocabulary and returns chart-ready data.
 *
 * @param {{ range?: '7d'|'30d'|'90d'|'1y' }} [options]
 * @returns {{
 *   range: string,
 *   setRange: (r: string) => void,
 *   periods: string[],
 *   series: Array<{ key: string, categoryId: number | null, name: string, color: string, total: number }>,
 *   chartData: Array<Record<string, number | string>>,
 *   total: number,
 *   isEmpty: boolean,
 *   isLoading: boolean,
 *   error: object | null,
 *   refresh: () => void,
 * }}
 */
export function useCategoryTimeseries({ range: initialRange = DEFAULT_RANGE } = {}) {
  const { user, isLoading: authLoading } = useAuth()

  const [range, setRange] = useState(initialRange)
  const [data, setData] = useState(null)
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

    let cancelled = false
    // Defer state writes off the effect body (mirrors useTransactionSummary) so
    // the fetch lifecycle never sets state synchronously during render.
    Promise.resolve().then(() => {
      if (cancelled) return
      if (!user) {
        setData(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      transactionsService
        .summaryByCategoryTimeseries({ range })
        .then((result) => {
          if (!cancelled) setData(result)
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
  }, [authLoading, user, range, refreshKey])

  const periods = data?.periods ?? []
  const spansMultipleYears =
    new Set(periods.map((p) => p.split('-')[0])).size > 1

  // Resolve each API series to a display label + colour, keyed by a stable slug
  // (category id, or "uncategorised" for the null bucket) so the chart dataKeys
  // never collide on label text. Drop zero-total categories so the legend and
  // stack only carry categories the user actually spent in.
  const series = (data?.series ?? [])
    .map((item) => {
      const meta = item.category_id == null ? UNCATEGORISED_META : CATEGORY_META[item.name]
      const resolved = meta ?? { ...UNCATEGORISED_META, label: item.name }
      return {
        key: item.category_id == null ? 'uncategorised' : String(item.category_id),
        categoryId: item.category_id,
        name: resolved.label,
        color: resolved.color,
        total: Number.parseFloat(item.total) || 0,
        points: (item.points ?? []).map((p) => Number.parseFloat(p) || 0),
      }
    })
    .filter((s) => s.total > 0)

  // One row per period; each carries a numeric field per category keyed by slug,
  // so a stacked chart reads straight off `chartData` with `series` as the keys.
  const chartData = periods.map((period, i) => {
    const row = { period, label: periodToLabel(period, spansMultipleYears) }
    for (const s of series) row[s.key] = s.points[i] ?? 0
    return row
  })

  const total = series.reduce((sum, s) => sum + s.total, 0)

  return {
    range,
    setRange,
    periods,
    series: series.map((s) => ({
      key: s.key,
      categoryId: s.categoryId,
      name: s.name,
      color: s.color,
      total: s.total,
    })),
    chartData,
    total,
    isEmpty: series.length === 0,
    isLoading: authLoading || isLoading,
    error,
    refresh,
  }
}

export default useCategoryTimeseries
