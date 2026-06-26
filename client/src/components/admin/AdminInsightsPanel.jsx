import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, ArrowUpRight, TicketCheck, TrendingUp } from 'lucide-react'

import { useAdminStats } from '@/hooks/useAdminStats'
import { TX_STATUS_META, TX_TYPE_META, HIDDEN_AMOUNT_LABEL, formatMonetaryValue } from '@/utils/transactionMeta'

const MONTHS = 6

const STATUS_BAR_COLORS = {
  pending: 'bg-warning',
  completed: 'bg-success',
  failed: 'bg-destructive',
  reversed: 'bg-muted-foreground/60',
}

function monthLabel(period) {
  const [year, month] = period.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' })
}

function buildChartData(monthly, amountsHidden) {
  const byPeriod = Object.fromEntries(
    (monthly ?? []).map((point) => [point.period, point])
  )
  const now = new Date()
  const data = []
  for (let i = MONTHS - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const point = byPeriod[period]
    data.push({
      label: monthLabel(period),
      volume: point && !point.volume_hidden ? Number.parseFloat(point.volume) : 0,
      count: point?.count ?? 0,
      volumeHidden: amountsHidden || Boolean(point?.volume_hidden),
    })
  }
  return data
}

function VolumeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const { volume, count, volumeHidden } = payload[0].payload
  return (
    <div className="rounded-input border border-border bg-card px-3 py-2.5 shadow-lg">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {volumeHidden ? (
        <p className="text-sm font-semibold text-card-foreground">{HIDDEN_AMOUNT_LABEL}</p>
      ) : (
        <p className="tabular-nums text-sm font-semibold text-card-foreground">{formatMonetaryValue(volume)}</p>
      )}
      <p className="text-xs text-muted-foreground">{count} transaction{count !== 1 ? 's' : ''}</p>
    </div>
  )
}

function CountTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const { count } = payload[0].payload
  return (
    <div className="rounded-input border border-border bg-card px-3 py-2.5 shadow-lg">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-card-foreground">{count} transaction{count !== 1 ? 's' : ''}</p>
    </div>
  )
}

function HeadlineStat({ icon, label, value, hint, to }) {
  const StatIcon = icon
  const body = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-input bg-primary/10 text-primary">
        <StatIcon className="size-4.5" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</p>
        <p className="truncate text-lg font-bold tabular-nums text-card-foreground">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="flex items-center gap-3 rounded-surface border border-border bg-background/60 p-3.5 transition-colors hover:bg-muted/30"
      >
        {body}
      </Link>
    )
  }
  return (
    <div className="flex items-center gap-3 rounded-surface border border-border bg-background/60 p-3.5">
      {body}
    </div>
  )
}

function DistributionBars({ title, counts, metaByName }) {
  const entries = Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, count]) => count))

  return (
    <div>
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <div className="space-y-2.5">
          {entries.map(([name, count]) => (
            <div key={name} className="grid grid-cols-[88px_1fr_40px] items-center gap-2">
              <span className="truncate text-xs capitalize text-muted-foreground">
                {metaByName?.[name] ?? name}
              </span>
              <div className="h-2 overflow-hidden rounded-pill bg-muted">
                <div
                  className={`h-full rounded-pill ${STATUS_BAR_COLORS[name] ?? 'bg-primary'}`}
                  style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
                />
              </div>
              <span className="text-right text-xs font-semibold tabular-nums text-card-foreground">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InsightsSkeleton() {
  return (
    <article className="animate-pulse rounded-panel border border-border bg-card p-5 sm:p-6" aria-busy="true">
      <div className="h-4 w-40 rounded bg-muted" />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-surface bg-muted" />
        ))}
      </div>
      <div className="mt-4 h-56 rounded-surface bg-muted" />
    </article>
  )
}

const STATUS_LABELS = Object.fromEntries(
  Object.values(TX_STATUS_META).map((meta) => [meta.label.toLowerCase(), meta.label])
)
const TYPE_LABELS = Object.fromEntries(
  Object.values(TX_TYPE_META).map((meta) => [meta.label.toLowerCase(), meta.label])
)

export default function AdminInsightsPanel() {
  const { txStats, requestStats, isLoading, error, refresh } = useAdminStats({ months: MONTHS })

  const chartData = useMemo(
    () => buildChartData(txStats?.monthly, txStats?.amounts_hidden),
    [txStats],
  )
  const amountsHidden = Boolean(txStats?.amounts_hidden)

  if (isLoading) return <InsightsSkeleton />

  if (error) {
    return (
      <article className="rounded-panel border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-destructive">Could not load platform activity.</p>
          <button
            type="button"
            className="rounded-input border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
            onClick={refresh}
          >
            Retry
          </button>
        </div>
      </article>
    )
  }

  return (
    <article className="rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-card-foreground sm:text-lg">Platform Activity</h2>
          <p className="text-xs text-muted-foreground">
            {amountsHidden ? `Transaction count, last ${MONTHS} months` : `Completed volume, last ${MONTHS} months`}
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <HeadlineStat
          icon={Activity}
          label="Transactions"
          value={txStats?.total_count?.toLocaleString('en-US') ?? '0'}
          hint="All time"
        />
        <HeadlineStat
          icon={TrendingUp}
          label="Completed Volume"
          value={formatMonetaryValue(txStats?.completed_volume, { hidden: amountsHidden })}
          hint="All time"
        />
        <HeadlineStat
          icon={TicketCheck}
          label="Pending Requests"
          value={requestStats?.pending ?? 0}
          hint="Open the requests queue"
          to="/support/tickets"
        />
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="h-56 w-full min-w-0">
          <ResponsiveContainer width="100%" height={224} minWidth={0}>
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
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                width={42}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', fillOpacity: 0.4 }}
                content={amountsHidden ? CountTooltip : VolumeTooltip}
              />
              <Bar
                dataKey={amountsHidden ? 'count' : 'volume'}
                fill="var(--primary)"
                radius={[6, 6, 0, 0]}
                maxBarSize={42}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-5">
          <DistributionBars title="By Status" counts={txStats?.by_status} metaByName={STATUS_LABELS} />
          <DistributionBars title="By Type" counts={txStats?.by_type} metaByName={TYPE_LABELS} />
        </div>
      </div>

      <p className="mt-4 flex items-center gap-1 text-[11px] text-muted-foreground">
        <ArrowUpRight className="size-3" aria-hidden />
        Refund requests: {requestStats?.approved ?? 0} approved, {requestStats?.declined ?? 0} declined, {requestStats?.total ?? 0} total.
      </p>
    </article>
  )
}
