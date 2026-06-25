import StatTile from './StatTile'
import Skeleton from '@/components/ui/skeleton'
import {
  cardStatusOverviewStatuses,
} from '@/utils/cardStatusOverview'

const ACCENT_CLASS = {
  active: 'bg-success',
  disabled: 'bg-destructive',
  inactive: 'bg-muted-foreground/40',
}

const DOT_CLASS = {
  active: 'bg-success',
  disabled: 'bg-destructive',
  inactive: 'bg-muted-foreground/50',
}

export default function CardStatsRow({
  totalCards = 0,
  statuses = cardStatusOverviewStatuses,
  statusCounts = {},
  compact = false,
  isLoading = false,
}) {
  const safeTotal = Math.max(totalCards, 1)

  if (compact) {
    return (
      <section className="rounded-panel border border-border bg-card px-5 py-4 shadow-sm">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Card status
        </p>
        <dl className="space-y-2.5">
          {statuses.map((status) => (
            <div key={status.id} className="flex items-center justify-between gap-3 text-sm">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <span
                  className={`size-1.5 rounded-full ${DOT_CLASS[status.id] ?? DOT_CLASS.inactive}`}
                  aria-hidden
                />
                {status.label}
              </dt>
              <dd className="tabular font-semibold text-card-foreground">
                {isLoading ? (
                  <Skeleton className="h-4 w-5 rounded" />
                ) : (
                  (statusCounts[status.id] ?? 0)
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {statuses.map((status) => {
        const count = statusCounts[status.id] ?? 0
        return (
          <StatTile
            key={status.id}
            label={status.label}
            count={count}
            percentage={Math.round((count / safeTotal) * 100)}
            accentClass={ACCENT_CLASS[status.id] ?? 'bg-muted-foreground/40'}
          />
        )
      })}
    </div>
  )
}
