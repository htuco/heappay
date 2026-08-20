import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertCircle, ArrowRight, ChevronRight, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/utils/api'
import { useSpendingByCategory } from '@/hooks/useSpendingByCategory'
import { useCategoryTimeseries } from '@/hooks/useCategoryTimeseries'

// Shared trailing-window vocabulary (mirrors /fx/insight). The breakdown
// endpoint only takes a month lookback, so map each range to a month count for
// that panel while the trend panel passes the range through verbatim.
const RANGES = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '1y', label: '1Y' },
]
const RANGE_TO_MONTHS = { '7d': 1, '30d': 1, '90d': 3, '1y': 12 }
const RANGE_NOUN = { '7d': 'last 7 days', '30d': 'last 30 days', '90d': 'last 90 days', '1y': 'last year' }

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const money = (n) => usd.format(Number(n) || 0)

// Compact currency for the y-axis: 4000 -> $4k. Full amounts cost more width
// than a phone axis has and read as counts, not money.
function formatAxisTick(value) {
  const n = Number(value) || 0
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${+(abs / 1_000_000).toFixed(1)}m`
  if (abs >= 1_000) return `$${+(abs / 1_000).toFixed(1)}k`
  return `$${abs}`
}

// ─── Range toggle ───────────────────────────────────────────────────────────

function RangeToggle({ range, onChange }) {
  return (
    <div className="inline-flex rounded-input border border-border bg-muted/40 p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => onChange(r.value)}
          aria-pressed={range === r.value}
          className={cn(
            'rounded-[6px] px-2.5 py-1 text-xs font-semibold transition-colors',
            range === r.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

// ─── Shared state visuals ─────────────────────────────────────────────────────

function PanelError({ error, onRetry, title }) {
  const message = getApiErrorMessage(error, 'Could not load spending data.')
  return (
    <div
      role="alert"
      className="flex flex-1 items-center justify-center rounded-input border border-destructive/25 bg-destructive/10 p-5"
    >
      <div className="flex max-w-md flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
        <AlertCircle className="h-8 w-8 shrink-0 text-destructive" aria-hidden="true" />
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-destructive">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-destructive/85">{message}</p>
          </div>
          {onRetry ? (
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-input border border-dashed border-border p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ─── Trends panel (month-on-month per category) ───────────────────────────────

function TrendsTooltip({ active, payload, label, seriesByKey }) {
  if (!active || !payload?.length) return null
  const rows = payload
    .filter((p) => (p.value ?? 0) > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  if (rows.length === 0) return null
  const total = rows.reduce((sum, r) => sum + (r.value ?? 0), 0)
  return (
    <div className="min-w-44 rounded-input border border-border bg-card px-3 py-2.5 shadow-lg">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.dataKey} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: r.color }}
                aria-hidden="true"
              />
              <span className="truncate text-card-foreground">
                {seriesByKey[r.dataKey]?.name ?? r.dataKey}
              </span>
            </span>
            <span className="shrink-0 tabular-nums font-medium text-card-foreground">
              {money(r.value)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between gap-4 border-t border-border pt-1.5 text-xs font-semibold">
        <span className="text-muted-foreground">Total</span>
        <span className="tabular-nums text-card-foreground">{money(total)}</span>
      </div>
    </div>
  )
}

function SpendTrendsPanel({ range, onRangeChange, trends, onDrill }) {
  const { chartData, series, isLoading, error, isEmpty, refresh } = trends
  const seriesByKey = Object.fromEntries(series.map((s) => [s.key, s]))

  return (
    <section className="flex min-w-0 flex-col rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-card-foreground sm:text-lg">Spending trends</h2>
          <p className="text-xs text-muted-foreground">
            Month-on-month spend per category · {RANGE_NOUN[range]}
          </p>
        </div>
        <RangeToggle range={range} onChange={onRangeChange} />
      </header>

      <div className="flex min-h-64 flex-1 flex-col">
        {isLoading ? (
          <div className="h-72 w-full animate-pulse rounded-surface bg-muted/60 sm:h-80" />
        ) : error ? (
          <PanelError error={error} onRetry={refresh} title="Could not load trends" />
        ) : isEmpty ? (
          <EmptyState message="No spending yet for this range." />
        ) : (
          <>
            <div className="h-72 w-full min-w-0 sm:h-80">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeOpacity={0.5}
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                    dy={6}
                    minTickGap={8}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                    tickFormatter={formatAxisTick}
                    width={44}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)', fillOpacity: 0.4 }}
                    content={(props) => <TrendsTooltip {...props} seriesByKey={seriesByKey} />}
                  />
                  {series.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      stackId="spend"
                      fill={s.color}
                      radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                      className={s.categoryId != null ? 'cursor-pointer' : undefined}
                      onClick={(entry) =>
                        entry?.payload && onDrill({ categoryId: s.categoryId, period: entry.payload.period })
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Clickable legend — a category chip deep-links to its transactions. */}
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {series.map((s) => {
                const clickable = s.categoryId != null
                const content = (
                  <>
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                      aria-hidden="true"
                    />
                    <span className="max-w-40 truncate">{s.name}</span>
                  </>
                )
                return (
                  <li key={s.key}>
                    {clickable ? (
                      <button
                        type="button"
                        onClick={() => onDrill({ categoryId: s.categoryId })}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {content}
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {content}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Tip: click a bar to open that month&apos;s transactions, or a category to filter by it.
            </p>
          </>
        )}
      </div>
    </section>
  )
}

// ─── Breakdown panel (every category, amount + share) ─────────────────────────

function BreakdownRow({ segment, total, onDrill }) {
  const share = total > 0 ? (segment.value / total) * 100 : 0
  const clickable = segment.key !== 'uncategorised'

  const body = (
    <>
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: segment.color }}
          aria-hidden="true"
        />
        <span className="truncate text-sm font-medium text-card-foreground">{segment.name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="tabular-nums text-sm font-semibold text-card-foreground">
          {money(segment.value)}
        </span>
        <span className="w-12 shrink-0 text-right tabular-nums text-xs text-muted-foreground">
          {share.toFixed(1)}%
        </span>
        {clickable ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <span className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
      </div>
    </>
  )

  return (
    <li>
      {clickable ? (
        <button
          type="button"
          onClick={() => onDrill({ categoryId: segment.categoryId })}
          className="group w-full rounded-input px-2 py-2 text-left transition-colors hover:bg-muted/50"
        >
          <div className="flex items-center justify-between gap-3">{body}</div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(share, 1.5)}%`, backgroundColor: segment.color }}
            />
          </div>
        </button>
      ) : (
        <div className="w-full rounded-input px-2 py-2">
          <div className="flex items-center justify-between gap-3">{body}</div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(share, 1.5)}%`, backgroundColor: segment.color }}
            />
          </div>
        </div>
      )}
    </li>
  )
}

function CategoryBreakdownPanel({ range, breakdown, onDrill }) {
  const { segments, total, isLoading, error, refresh } = breakdown
  // segments carry name/value/color/key; attach categoryId for deep-linking.
  const rows = segments.map((s) => ({
    ...s,
    categoryId: s.key === 'uncategorised' ? null : Number(s.key),
  }))

  return (
    <section className="flex min-w-0 flex-col rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6">
      <header className="mb-4 space-y-1">
        <h2 className="text-base font-semibold text-card-foreground sm:text-lg">Spending by category</h2>
        <p className="text-xs text-muted-foreground">
          Every category · {RANGE_NOUN[range]}
        </p>
      </header>

      <div className="flex min-h-64 flex-1 flex-col">
        {isLoading ? (
          <ul className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="h-10 w-full animate-pulse rounded-input bg-muted/60" />
            ))}
          </ul>
        ) : error ? (
          <PanelError error={error} onRetry={refresh} title="Could not load categories" />
        ) : rows.length === 0 ? (
          <EmptyState message="No spending yet for this range." />
        ) : (
          <>
            <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-border pb-3">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Total spend</span>
              <span className="tabular-nums text-lg font-semibold text-card-foreground">
                {money(total)}
              </span>
            </div>
            <ul className="-mx-2 space-y-1">
              {rows.map((segment) => (
                <BreakdownRow
                  key={segment.key}
                  segment={segment}
                  total={total}
                  onDrill={onDrill}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Build a deep-link into the transaction history that honours the existing
 * filter params: `category` (direct), and `from`/`to` for a month window.
 */
function toTransactionsHref({ categoryId, period }) {
  const params = new URLSearchParams()
  if (categoryId != null) params.set('category', String(categoryId))
  if (period) {
    const [year, month] = period.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    params.set('from', `${period}-01`)
    params.set('to', `${period}-${String(lastDay).padStart(2, '0')}`)
    params.set('sort', 'amount_desc')
  }
  const query = params.toString()
  return query ? `/transactions?${query}` : '/transactions'
}

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const [range, setRange] = usePersistentRange('90d')

  const months = RANGE_TO_MONTHS[range]
  const breakdown = useSpendingByCategory({ months })
  const trends = useCategoryTimeseries({ range })

  // Keep the breakdown's month lookback in sync with the shared range control.
  const { setMonths } = breakdown
  useSyncMonths(setMonths, months)

  const handleRangeChange = (next) => {
    setRange(next)
    trends.setRange(next)
  }

  const drill = (target) => navigate(toTransactionsHref(target))

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SpendTrendsPanel
            range={range}
            onRangeChange={handleRangeChange}
            trends={trends}
            onDrill={drill}
          />
        </div>
        <div className="xl:col-span-1">
          <CategoryBreakdownPanel range={range} breakdown={breakdown} onDrill={drill} />
        </div>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        Looking for a single transaction?
        <Link
          to="/transactions"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Browse all transactions
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </p>
    </div>
  )
}

// ── small hooks kept local to the page ────────────────────────────────────────

const RANGE_STORAGE_KEY = 'heap.analytics.range'

// Persist the chosen range so returning to the page keeps the user's window.
function usePersistentRange(fallback) {
  const [range, setRange] = useState(() => {
    try {
      const stored = window.localStorage.getItem(RANGE_STORAGE_KEY)
      return RANGES.some((r) => r.value === stored) ? stored : fallback
    } catch {
      return fallback
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem(RANGE_STORAGE_KEY, range)
    } catch {
      // Ignore storage failures (private mode) — the range still works in-session.
    }
  }, [range])
  return [range, setRange]
}

// Push `months` into the breakdown hook only when it actually changes.
function useSyncMonths(setMonths, months) {
  const prev = useRef(months)
  useEffect(() => {
    if (prev.current !== months) {
      prev.current = months
      setMonths(months)
    }
  }, [setMonths, months])
}
