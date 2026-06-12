import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { RefreshCw, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/utils/api'

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function NetTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const net = payload[0]?.value ?? 0
  const fmt = (n) =>
    `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <div className="rounded-input border border-border bg-card px-3 py-2.5 shadow-lg">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`tabular-nums text-sm font-semibold ${
          net >= 0 ? 'text-success' : 'text-destructive'
        }`}
      >
        {net < 0 ? '-' : ''}{fmt(net)}
      </p>
    </div>
  )
}

// Legacy single-series tooltip (backwards-compat fallback)
function SingleTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-input border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabular-nums text-sm font-semibold text-card-foreground">
        ${payload[0].value.toLocaleString()}
      </p>
    </div>
  )
}

// ─── Shimmer ──────────────────────────────────────────────────────────────────

function ChartShimmer() {
  return (
    <div className="h-64 w-full animate-pulse rounded-surface bg-muted/60" />
  )
}

function ChartErrorState({ error, onRetry }) {
  const message = getApiErrorMessage(error, 'Could not load transaction data.')

  return (
    <div
      role="alert"
      className="flex h-64 items-center justify-center rounded-input border border-destructive/25 bg-destructive/10 p-5"
    >
      <div className="flex max-w-md flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
        <AlertCircle className="h-8 w-8 shrink-0 text-destructive" aria-hidden="true" />
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-destructive">Could not load money flow</h3>
            <p className="mt-1 text-sm leading-6 text-destructive/85">{message}</p>
          </div>
          {onRetry ? (
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Please refresh the page to try again.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * @param {{
 *   chartData?: { label: string, income: number, expense: number, net: number }[],
 *   isLoading?: boolean,
 *   error?: unknown,
 *   onRetry?: () => void,
 *   points?: number[],
 *   labels?: string[],
 * }} props
 */
export default function MoneyFlowPlaceholder({
  chartData,
  isLoading = false,
  error = null,
  onRetry,
  // legacy fallback props
  points,
  labels,
}) {
  // Determine which data path to use
  const useDual = chartData !== undefined

  // Build chart data
  const data = useDual
    ? chartData
    : (labels ?? []).map((label, i) => ({ label, value: (points ?? [])[i] ?? 0 }))

  // With padding in the hook, chartData always has `months` entries when real
  // data is available. Only show the empty state when the array is truly empty
  // (e.g. auth not yet resolved).
  const isEmpty = useDual && chartData.length === 0

  return (
    <section className="flex h-full min-w-0 flex-col rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-card-foreground sm:text-lg">
            Money Flow
          </h2>
          <p className="text-xs text-muted-foreground">Last 6 months</p>
        </div>
      </header>

      {/* Loading */}
      {isLoading && <ChartShimmer />}

      {/* Error */}
      {!isLoading && error ? <ChartErrorState error={error} onRetry={onRetry} /> : null}

      {/* Empty state */}
      {!isLoading && !error && isEmpty && (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        </div>
      )}

      {/* Chart */}
      {!isLoading && !error && !isEmpty && (
        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height={256} minWidth={0}>
            {useDual ? (
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  width={42}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--primary)', strokeOpacity: 0.4, strokeWidth: 1 }}
                  content={NetTooltip}
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#netGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 2 }}
                />
              </AreaChart>
            ) : (
              /* Legacy single-series fallback */
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="moneyFlowFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  width={42}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--primary)', strokeOpacity: 0.4, strokeWidth: 1 }}
                  content={SingleTooltip}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#moneyFlowFill)"
                  dot={false}
                  activeDot={{ r: 5, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 2 }}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
