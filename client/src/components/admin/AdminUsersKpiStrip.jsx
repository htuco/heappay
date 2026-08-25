import { BarChart3, CreditCard, Lock, Target, Users } from 'lucide-react'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'


const TILES = [
  {
    key: 'totalUsers',
    label: 'Total Users',
    hint: 'All team members',
    icon: Users,
    tone: 'bg-primary/10 text-primary',
  },
  {
    key: 'activeUsers',
    label: 'Active Users',
    hint: (totals) =>
      totals.totalUsers > 0
        ? `${Math.round((totals.activeUsers / totals.totalUsers) * 100)}% of total`
        : '—',
    icon: Target,
    tone: 'bg-success/10 text-success',
  },
  {
    key: 'totalCards',
    label: 'Cards Issued',
    hint: 'Across all users',
    icon: CreditCard,
    tone: 'bg-info/10 text-info',
  },
  {
    key: 'frozenCards',
    label: 'Frozen Cards',
    hint: (totals) =>
      totals.totalCards > 0
        ? `${((totals.frozenCards / totals.totalCards) * 100).toFixed(1)}% of all cards`
        : '—',
    icon: Lock,
    tone: 'bg-warning/10 text-warning',
  },
  {
    // Backed by the per-user total_spent the users list now carries, summed
    // client-side. Dropped the "(MTD)" qualifier: the aggregate is all-time
    // completed spend, so labelling it month-to-date would have been wrong.
    key: 'totalSpend',
    label: 'Total Spend',
    hint: 'Across all users',
    icon: BarChart3,
    tone: 'bg-secondary text-secondary-foreground',
    isMoney: true,
  },
]

function TileSkeleton() {
  return (
    <article className="flex min-h-24 animate-pulse items-center gap-3 rounded-surface border border-border/60 bg-background/50 p-4">
      <div className="size-10 rounded-input bg-muted" />
      <div className="min-w-0 flex-1">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="mt-3 h-6 w-14 rounded bg-muted" />
      </div>
    </article>
  )
}

export default function AdminUsersKpiStrip({ kpiTotals, isLoading = false }) {
  const { formatMoney } = useDisplayCurrency()
  if (isLoading) {
    return (
      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
        aria-busy="true"
        aria-label="Loading user metrics"
      >
        {TILES.map((tile) => (
          <TileSkeleton key={tile.key} />
        ))}
      </section>
    )
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="User metrics">
      {TILES.map((tile) => {
        const TileIcon = tile.icon
        const raw = kpiTotals[tile.key]
        const value = tile.isMoney
          ? formatMoney(raw)
          : (raw ?? 0).toLocaleString('en-US')
        const hint = typeof tile.hint === 'function' ? tile.hint(kpiTotals) : tile.hint

        return (
          <article
            key={tile.key}
            className="flex min-h-24 items-center gap-3 rounded-surface border border-border/60 bg-background/50 p-4"
            aria-label={`${tile.label}: ${value}`}
          >
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-input ${tile.tone}`}>
              <TileIcon className="size-4.5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {tile.label}
              </p>
              <p className="mt-0.5 text-2xl font-bold leading-none tabular-nums text-card-foreground">{value}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
            </div>
          </article>
        )
      })}
    </section>
  )
}
