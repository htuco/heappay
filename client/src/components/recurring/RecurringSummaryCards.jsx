import { CalendarCheck2, CalendarClock, Repeat2, TriangleAlert } from 'lucide-react'

import Skeleton from '@/components/ui/skeleton'
import {
  DUE_SOON_DAYS,
  formatRecurringAmount,
  summarizeRecurringPayments,
} from '@/utils/recurringPayments.utils'

function SummaryTile({ icon, label, value, sub, accentClass, labelClass, isLoading }) {
  const Icon = icon

  return (
    <div className="rounded-surface border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-input ${accentClass}`}
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
        <p className={`text-sm font-semibold ${labelClass}`}>{label}</p>
      </div>
      {isLoading ? (
        <>
          <Skeleton className="mt-3 h-8 w-20" />
          <Skeleton className="mt-2 h-3.5 w-28" />
        </>
      ) : (
        <>
          <p className="tabular mt-3 text-2xl font-bold tracking-tight text-card-foreground">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </>
      )}
    </div>
  )
}

function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * Summary row for the recurring payments page. Everything here is derived from
 * the list payload the page already fetched — see
 * `summarizeRecurringPayments` for why there is no Paused/Completed tile.
 */
export default function RecurringSummaryCards({ rules, isLoading = false }) {
  const stats = summarizeRecurringPayments(rules)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryTile
        icon={Repeat2}
        label="Active Plans"
        value={stats.activeCount}
        sub={`${formatRecurringAmount(stats.activeTotal)} per full cycle`}
        accentClass="bg-primary/10 text-primary"
        labelClass="text-primary"
        isLoading={isLoading}
      />
      <SummaryTile
        icon={CalendarClock}
        label={`Upcoming (${DUE_SOON_DAYS} days)`}
        value={stats.dueSoonCount}
        sub={`${formatRecurringAmount(stats.dueSoonTotal)} leaving soon`}
        accentClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        labelClass="text-violet-600 dark:text-violet-400"
        isLoading={isLoading}
      />
      <SummaryTile
        icon={CalendarCheck2}
        label="Scheduled This Month"
        value={formatRecurringAmount(stats.dueThisMonthTotal)}
        sub={`across ${plural(stats.dueThisMonthCount, 'payment')}`}
        accentClass="bg-success/10 text-success"
        labelClass="text-success"
        isLoading={isLoading}
      />
      <SummaryTile
        icon={TriangleAlert}
        label="Action Required"
        value={stats.needsAttentionCount}
        sub={
          stats.needsAttentionCount === 0
            ? 'All runs succeeded'
            : `${plural(stats.needsAttentionCount, 'payment')} failed last run`
        }
        accentClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        labelClass="text-amber-600 dark:text-amber-400"
        isLoading={isLoading}
      />
    </div>
  )
}
