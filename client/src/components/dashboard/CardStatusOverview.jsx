import {
  cardStatusOverviewStatuses,
  cardStatusOverviewTitle,
} from '@/mock-data/paymentCardMockData'

const dotClassMap = {
  active: 'bg-emerald-500',
  disabled: 'bg-rose-500',
  inactive: 'bg-muted-foreground/50',
}

const chipClassMap = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  disabled: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  inactive: 'bg-muted text-muted-foreground',
}

export default function CardStatusOverview({
  title = cardStatusOverviewTitle,
  totalCards = 0,
  statuses = cardStatusOverviewStatuses,
  statusCounts = {},
}) {
  return (
    <section className="flex h-full flex-col rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-card-foreground sm:text-lg">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">Total Cards: {totalCards}</p>
      </header>

      <ul className="space-y-3">
        {statuses.map((status) => {
          const count = statusCounts[status.id] ?? 0
          const percentage = Math.round((count / Math.max(totalCards, 1)) * 100)
          const dotClass = dotClassMap[status.id] ?? 'bg-muted-foreground/50'
          const chipClass = chipClassMap[status.id] ?? 'bg-muted text-muted-foreground'
          return (
            <li
              key={status.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-card-foreground">{status.label}</p>
                  <p className="tabular text-lg font-semibold leading-tight text-card-foreground">
                    {count}
                  </p>
                </div>
              </div>
              <span
                className={`tabular shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${chipClass}`}
              >
                {percentage}%
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
