import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { AlertCircle, PieChart as PieChartIcon, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/utils/api'
import { useSpendingByCategory } from '@/hooks/useSpendingByCategory'

function formatMoney(n) {
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function CategoryTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const segment = payload[0]?.payload
  if (!segment) return null
  const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0
  return (
    <div className="rounded-input border border-border bg-card px-3 py-2.5 shadow-lg">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-card-foreground">
        <span className="size-2 rounded-full" style={{ backgroundColor: segment.color }} />
        {segment.name}
      </p>
      <p className="tabular-nums text-sm font-semibold text-card-foreground">
        {formatMoney(segment.value)}
        <span className="ml-1 font-normal text-muted-foreground">· {pct}%</span>
      </p>
    </div>
  )
}

function ChartShimmer() {
  return <div className="h-64 w-full animate-pulse rounded-surface bg-muted/60" />
}

function ChartErrorState({ error, onRetry }) {
  const message = getApiErrorMessage(error, 'Could not load spending data.')
  return (
    <div
      role="alert"
      className="flex h-64 items-center justify-center rounded-input border border-destructive/25 bg-destructive/10 p-5"
    >
      <div className="flex max-w-md flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
        <AlertCircle className="h-8 w-8 shrink-0 text-destructive" aria-hidden="true" />
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-destructive">
              Could not load spending by category
            </h3>
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

export default function SpendingByCategory({ months = 6, bare = false }) {
  const { segments, total, isLoading, error, refresh } = useSpendingByCategory({ months })
  const isEmpty = segments.length === 0

  return (
    <section
      className={
        bare
          ? 'flex h-full min-w-0 flex-col'
          : 'flex h-full min-w-0 flex-col rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6'
      }
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-card-foreground sm:text-lg">
            Spending by Category
          </h2>
          <p className="text-xs text-muted-foreground">Last {months} months</p>
        </div>
      </header>

      {isLoading && <ChartShimmer />}

      {!isLoading && error ? <ChartErrorState error={error} onRetry={refresh} /> : null}

      {!isLoading && !error && isEmpty && (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
          <PieChartIcon className="size-7 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No spending yet.</p>
        </div>
      )}

      {!isLoading && !error && !isEmpty && (
        <div
          className={
            bare
              ? 'flex flex-col gap-4'
              : 'flex flex-col gap-4 sm:flex-row sm:items-center'
          }
        >
          <div className={`relative mx-auto h-56 w-full min-w-0 ${bare ? 'max-w-56' : 'sm:w-56 sm:shrink-0'}`}>
            <ResponsiveContainer width="100%" height={224} minWidth={0}>
              <PieChart>
                <Pie
                  data={segments}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {segments.map((segment) => (
                    <Cell key={segment.key} fill={segment.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<CategoryTooltip total={total} />}
                  wrapperStyle={{ zIndex: 20, pointerEvents: 'none' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center total */}
            <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Total
              </span>
              <span className="tabular-nums text-base font-semibold text-card-foreground">
                {formatMoney(total)}
              </span>
            </div>
          </div>

          {/* Legend */}
          <ul className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden">
            {segments.map((segment) => {
              const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0
              return (
                <li
                  key={segment.key}
                  className="grid grid-cols-[0.625rem_minmax(0,1fr)_2.25rem_4.75rem] items-center gap-x-2 text-sm"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="min-w-0 truncate text-card-foreground">{segment.name}</span>
                  <span className="shrink-0 text-right tabular-nums text-muted-foreground">
                    {pct}%
                  </span>
                  <span className="shrink-0 text-right tabular-nums font-medium text-card-foreground">
                    {formatMoney(segment.value)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
