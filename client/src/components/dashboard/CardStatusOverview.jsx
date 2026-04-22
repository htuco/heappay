import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import DashboardWidgetShell from '@/components/dashboard/DashboardWidgetShell'
import {
  cardStatusOverviewStatuses,
  cardStatusOverviewThemeMap,
  cardStatusOverviewTitle,
} from '@/mock-data/paymentCardMockData'

const iconMap = {
  checkCircle: CheckCircle2,
  alertTriangle: AlertTriangle,
  shieldAlert: ShieldAlert,
}

export default function CardStatusOverview({
  title = cardStatusOverviewTitle,
  totalCards = 0,
  statuses = cardStatusOverviewStatuses,
  statusCounts = {},
}) {
  return (
    <DashboardWidgetShell title={title} summary={totalCards}>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {statuses.map((status) => {
          const Icon = iconMap[status.icon] ?? CheckCircle2
          const count = statusCounts[status.id] ?? 0
          const toneClass = cardStatusOverviewThemeMap[status.id] ?? {
            iconWrapperClass: 'bg-accent/10 text-accent',
            chipClass: 'border-accent/25 bg-accent/10 text-accent',
            progressTrackClass: 'bg-accent/15',
            progressBarClass: 'bg-accent',
          }

          return (
            <article
              key={status.id}
              className="min-w-0 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                  <p className="mt-1 break-words text-lg font-semibold leading-tight">{status.label}</p>
                </div>
                <span className={`shrink-0 rounded-full p-2 ${toneClass.iconWrapperClass}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-7 flex min-w-0 items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Cards</p>
                  <p className="mt-1 text-3xl font-bold leading-none tabular-nums">{count}</p>
                </div>
                <p
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass.chipClass}`}
                >
                  {Math.round((count / Math.max(totalCards, 1)) * 100)}%
                </p>
              </div>
              <div className={`mt-3 h-1.5 rounded-full ${toneClass.progressTrackClass}`}>
                <div
                  className={`h-full rounded-full ${toneClass.progressBarClass}`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((count / Math.max(totalCards, 1)) * 100)
                    )}%`,
                  }}
                />
              </div>
            </article>
          )
        })}
      </div>
    </DashboardWidgetShell>
  )
}
