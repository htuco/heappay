import { CreditCard, ShieldOff, UserCheck, Users } from 'lucide-react'

const KPI_ITEMS = [
  {
    key: 'totalUsers',
    label: 'Total Users',
    description: 'Registered accounts',
    icon: Users,
    tone: 'bg-primary/10 text-primary',
  },
  {
    key: 'activeUsers',
    label: 'Active Users',
    description: 'Ready to transact',
    icon: UserCheck,
    tone: 'bg-success/10 text-success',
  },
  {
    key: 'totalCards',
    label: 'Total Cards',
    description: 'Issued cards',
    icon: CreditCard,
    tone: 'bg-info/10 text-info',
  },
  {
    key: 'disabledCards',
    label: 'Disabled Cards',
    description: 'Frozen or inactive',
    icon: ShieldOff,
    tone: 'bg-warning/10 text-warning',
  },
]

function KpiCardSkeleton() {
  return (
    <article className="flex min-h-24 animate-pulse items-center gap-3 rounded-surface border border-border bg-card p-4 shadow-sm">
      <div className="size-10 rounded-input bg-muted" />
      <div className="min-w-0 flex-1">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="mt-3 h-6 w-14 rounded bg-muted" />
      </div>
    </article>
  )
}

export default function AdminKpiRow({ kpiTotals, isLoading = false }) {
  if (isLoading) {
    return (
      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-busy="true"
        aria-label="Loading admin metrics"
      >
        {KPI_ITEMS.map((item) => (
          <KpiCardSkeleton key={item.key} />
        ))}
      </section>
    )
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Admin overview">
      {KPI_ITEMS.map((item) => {
        const value = kpiTotals[item.key]
        const MetricIcon = item.icon

        return (
          <article
            key={item.key}
            className="group flex min-h-24 items-center gap-3 rounded-surface border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/20"
            aria-label={`${item.label}: ${value}`}
          >
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-input ${item.tone}`}>
              <MetricIcon className="size-4.5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {item.label}
              </p>
              <div className="mt-0.5 flex items-baseline gap-2">
                <p className="text-2xl font-bold leading-none tabular-nums text-card-foreground">{value}</p>
                <p className="truncate text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
          </article>
        )
      })}
    </section>
  )
}
