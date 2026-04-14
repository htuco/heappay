import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import DashboardWidgetShell from '@/components/dashboard/DashboardWidgetShell'

const iconMap = {
  checkCircle: CheckCircle2,
  alertTriangle: AlertTriangle,
  shieldAlert: ShieldAlert,
}

const statusThemeMap = {
  active: {
    iconWrapperClass: 'bg-primary/10 text-primary',
    chipClass: 'border-primary/25 bg-primary/10 text-primary',
    progressTrackClass: 'bg-primary/15',
    progressBarClass: 'bg-primary',
  },
  blocked: {
    iconWrapperClass: 'bg-destructive/10 text-destructive',
    chipClass: 'border-destructive/25 bg-destructive/10 text-destructive',
    progressTrackClass: 'bg-destructive/15',
    progressBarClass: 'bg-destructive',
  },
  reported: {
    iconWrapperClass: 'bg-secondary/20 text-secondary-foreground',
    chipClass: 'border-secondary/30 bg-secondary/30 text-secondary-foreground',
    progressTrackClass: 'bg-secondary/30',
    progressBarClass: 'bg-secondary-foreground/70',
  },
}

export default function CardStatusOverview({
  title = 'Card Status Overview',
  totalCards = 0,
  statuses = [],
  statusCounts = {},
}) {
  return (
    <DashboardWidgetShell title={title} summary={totalCards}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {statuses.map((status) => {
          const Icon = iconMap[status.icon] ?? CheckCircle2
          const count = statusCounts[status.id] ?? 0
          const toneClass = statusThemeMap[status.id] ?? {
            iconWrapperClass: 'bg-accent/10 text-accent',
            chipClass: 'border-accent/25 bg-accent/10 text-accent',
            progressTrackClass: 'bg-accent/15',
            progressBarClass: 'bg-accent',
          }

          return (
            <article
              key={status.id}
              className="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                  <p className="mt-1 text-lg font-semibold leading-tight">{status.label}</p>
                </div>
                <span className={`rounded-full p-2 ${toneClass.iconWrapperClass}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-7 flex items-end justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Cards</p>
                  <p className="mt-1 text-3xl font-bold leading-none tabular-nums">{count}</p>
                </div>
                <p className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass.chipClass}`}>
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
