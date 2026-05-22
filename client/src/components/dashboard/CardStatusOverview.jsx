import {
  cardStatusOverviewStatuses,
  cardStatusOverviewTitle,
} from '@/utils/cardStatusOverview'

const dotClassMap = {
  active: 'bg-success shadow-[0_0_0_3px_rgba(34,197,94,0.14)]',
  disabled: 'bg-destructive shadow-[0_0_0_3px_rgba(239,68,68,0.14)]',
  inactive: 'bg-muted-foreground/50 shadow-[0_0_0_3px_rgba(100,116,139,0.14)]',
}

const chipClassMap = {
  active: 'bg-success/10 text-success ring-success/20',
  disabled: 'bg-destructive/10 text-destructive ring-destructive/20',
  inactive: 'bg-muted text-muted-foreground ring-border',
}

export default function CardStatusOverview({
  title = cardStatusOverviewTitle,
  totalCards = 0,
  statuses = cardStatusOverviewStatuses,
  statusCounts = {},
}) {
  const safeTotal = Math.max(totalCards, 1)
  const activeCount = statusCounts.active ?? 0
  const activePercentage = Math.round((activeCount / safeTotal) * 100)
  const activeWidth = totalCards > 0 ? activePercentage : 0

  return (
    <section
      className="flex h-full flex-col rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <header className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-card-foreground">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Total Cards: {totalCards}</p>
      </header>

      <div className="mt-5 rounded-input border border-border bg-muted/20 p-3.5">
        <div
          className="h-2 overflow-hidden rounded-pill bg-muted"
          role="img"
          aria-label={`${activePercentage}% of cards active`}
        >
          <span
            className="block h-full rounded-pill bg-success"
            style={{ width: `${activeWidth}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <p className="font-medium text-muted-foreground">
            {activeCount} of {totalCards} cards active
          </p>
          <p className="tabular shrink-0 font-semibold text-success">{activePercentage}%</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {statuses.map((status) => {
          const count = statusCounts[status.id] ?? 0
          const percentage = Math.round((count / safeTotal) * 100)
          const dotClass = dotClassMap[status.id] ?? 'bg-muted-foreground/50'
          const chipClass = chipClassMap[status.id] ?? 'bg-muted text-muted-foreground ring-border'
          return (
            <li
              key={status.id}
              className="flex items-center justify-between gap-3 rounded-input border border-border bg-muted/20 px-3.5 py-3 transition-colors hover:bg-muted/35"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
                <p className="truncate text-sm font-medium text-card-foreground">
                  {status.label}
                </p>
              </div>
              <div className="grid shrink-0 grid-cols-[2.5rem_3.5rem] items-center gap-3">
                <span className="tabular text-right text-base font-semibold leading-none text-card-foreground">
                  {count}
                </span>
                <span
                  className={`tabular rounded-pill px-2.5 py-1 text-center text-xs font-semibold ring-1 ${chipClass}`}
                >
                  {percentage}%
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
