import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const DEFAULT_POINTS = [7800, 10200, 11400, 11000, 12600, 12300]
const DEFAULT_LABELS = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr']

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="tabular text-sm font-semibold text-card-foreground">
        ${payload[0].value.toLocaleString()}
      </p>
    </div>
  )
}

export default function MoneyFlowPlaceholder({
  points = DEFAULT_POINTS,
  labels = DEFAULT_LABELS,
}) {
  const data = labels.map((label, i) => ({ label, value: points[i] ?? 0 }))

  return (
    <section className="flex h-full flex-col rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-card-foreground sm:text-lg">
            Money Flow (Placeholder)
          </h2>
          <p className="text-xs text-muted-foreground">
            Placeholder chart for incoming/outgoing money and transactions
          </p>
        </div>
        <button
          type="button"
          className="text-sm font-medium text-primary hover:underline"
        >
          View more
        </button>
      </header>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
              content={<ChartTooltip />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill="url(#moneyFlowFill)"
              dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
