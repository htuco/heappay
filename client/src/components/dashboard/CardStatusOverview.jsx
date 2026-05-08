import WalletSection from '@/components/wallet/WalletSection'
import {
  cardStatusOverviewStatuses,
  cardStatusOverviewTitle,
} from '@/utils/cardStatusOverview'

const dotClassMap = {
  active: 'bg-success',
  disabled: 'bg-destructive',
  inactive: 'bg-muted-foreground/50',
}

const segmentClassMap = {
  active: 'bg-success',
  disabled: 'bg-destructive',
  inactive: 'bg-muted-foreground/40',
}

const chipClassMap = {
  active: 'bg-success/10 text-success',
  disabled: 'bg-destructive/10 text-destructive',
  inactive: 'bg-muted text-muted-foreground',
}

export default function CardStatusOverview({
  title = cardStatusOverviewTitle,
  totalCards = 0,
  statuses = cardStatusOverviewStatuses,
  statusCounts = {},
}) {
  const safeTotal = Math.max(totalCards, 1)
  const hasCards = totalCards > 0

  return (
    <WalletSection
      title={title}
      subtitle={`Total Cards: ${totalCards}`}
      className="h-full"
    >
      {hasCards ? (
        <div
          className="mb-5 flex h-2 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label="Card status distribution"
        >
          {statuses.map((status) => {
            const count = statusCounts[status.id] ?? 0
            if (count === 0) return null
            const width = (count / safeTotal) * 100
            const segmentClass = segmentClassMap[status.id] ?? 'bg-muted-foreground/40'
            return (
              <span
                key={status.id}
                className={`h-full ${segmentClass}`}
                style={{ width: `${width}%` }}
              />
            )
          })}
        </div>
      ) : null}

      <ul className="space-y-2.5">
        {statuses.map((status) => {
          const count = statusCounts[status.id] ?? 0
          const percentage = Math.round((count / safeTotal) * 100)
          const dotClass = dotClassMap[status.id] ?? 'bg-muted-foreground/50'
          const chipClass = chipClassMap[status.id] ?? 'bg-muted text-muted-foreground'
          return (
            <li
              key={status.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
                <p className="truncate text-sm font-medium text-card-foreground">
                  {status.label}
                </p>
              </div>
              <div className="flex shrink-0 items-baseline gap-3">
                <span className="tabular text-base font-semibold leading-none text-card-foreground">
                  {count}
                </span>
                <span
                  className={`tabular rounded-full px-2.5 py-0.5 text-xs font-medium ${chipClass}`}
                >
                  {percentage}%
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </WalletSection>
  )
}
