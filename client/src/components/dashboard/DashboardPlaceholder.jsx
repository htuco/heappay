import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react'
import { getApiErrorMessage } from '@/utils/api'
import { mapTransactionToActivityItem } from '@/utils/dashboardRecentActivity'

function ActivitySkeletonRow() {
  return (
    <li className="flex animate-pulse items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="h-9 w-9 shrink-0 rounded-full bg-muted" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 max-w-[14rem] rounded bg-muted sm:w-[72%]" />
          <div className="h-3 w-24 rounded bg-muted/80" />
        </div>
      </div>
      <div className="h-4 w-16 shrink-0 rounded bg-muted" />
    </li>
  )
}

/**
 * @param {{
 *   title?: string,
 *   transactions?: import('@/types/transaction').Transaction[],
 *   activityContext: {
 *     currentUserCardIds: Set<number>,
 *     lastFourByCardId: Map<number, string>,
 *     typeNameById: Record<number, string>,
 *   },
 *   isLoading?: boolean,
 *   error?: unknown,
 * }} props
 */
export default function DashboardPlaceholder({
  title = 'Recent Activity',
  transactions = [],
  activityContext,
  isLoading = false,
  error = null,
}) {
  const items = useMemo(() => {
    if (!transactions.length) return []
    return transactions.map((tx) => mapTransactionToActivityItem(tx, activityContext))
  }, [transactions, activityContext])

  const errorText =
    error != null
      ? getApiErrorMessage(error, 'Could not load recent activity.')
      : null

  const showList = !isLoading && !errorText

  return (
    <section className="flex h-full flex-col rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-card-foreground sm:text-lg">{title}</h2>
        <Link
          to="/wallet"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View All
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </header>

      {isLoading ? (
        <ul className="divide-y divide-border/60">
          <ActivitySkeletonRow />
          <ActivitySkeletonRow />
          <ActivitySkeletonRow />
        </ul>
      ) : null}

      {!isLoading && errorText ? (
        <p className="text-xs text-destructive">{errorText}</p>
      ) : null}

      {showList && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recent activity yet — add a card and start a transfer
        </p>
      ) : null}

      {showList && items.length > 0 ? (
        <ul className="divide-y divide-border/60">
          {items.map((item) => {
            const isIn = item.direction === 'in'
            const Icon = isIn ? ArrowDownLeft : ArrowUpRight
            const iconWrap = isIn
              ? 'bg-success/10 text-success'
              : 'bg-muted text-muted-foreground'
            const amountColor = isIn ? 'text-success' : 'text-muted-foreground'
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`shrink-0 rounded-full p-2 ${iconWrap}`}>
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-card-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                  </div>
                </div>
                <p className={`shrink-0 tabular-nums text-sm font-semibold ${amountColor}`}>
                  {item.amount}
                </p>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
