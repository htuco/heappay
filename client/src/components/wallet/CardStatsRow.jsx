import { Fragment } from 'react'

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

// Dots share the Dashboard CardStatusOverview treatment (soft ring halo) so the
// status reads in one visual language across the app.
const DOT_CLASS = {
  active: 'bg-success shadow-[0_0_0_3px_rgba(34,197,94,0.14)]',
  disabled: 'bg-destructive shadow-[0_0_0_3px_rgba(239,68,68,0.14)]',
  inactive: 'bg-muted-foreground/50 shadow-[0_0_0_3px_rgba(100,116,139,0.14)]',
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
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs"
        aria-label="Card status"
      >
        {statuses.map((status, index) => (
          <Fragment key={status.id}>
            {index > 0 && (
              <span className="text-muted-foreground/40" aria-hidden>
                ·
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`size-2 shrink-0 rounded-full ${DOT_CLASS[status.id] ?? DOT_CLASS.inactive}`}
                aria-hidden
              />
              <span className="text-muted-foreground">{status.label}</span>
              <span className="tabular font-semibold text-card-foreground">
                {isLoading ? (
                  <Skeleton className="inline-block h-3 w-4 rounded align-middle" />
                ) : (
                  (statusCounts[status.id] ?? 0)
                )}
              </span>
            </span>
          </Fragment>
        ))}
      </div>
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
