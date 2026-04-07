import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import DashboardWidgetShell from '@/components/dashboard/DashboardWidgetShell'

const iconMap = {
  checkCircle: CheckCircle2,
  alertTriangle: AlertTriangle,
  shieldAlert: ShieldAlert,
}

export default function CardStatusOverview({
  title = 'Card Status Overview',
  totalCards = 0,
  statuses = [],
  statusCounts = {},
}) {
  return (
    <DashboardWidgetShell title={title} summary={totalCards}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {statuses.map((status) => {
          const Icon = iconMap[status.icon] ?? CheckCircle2
          const count = statusCounts[status.id] ?? 0

          return (
            <article
              key={status.id}
              className={`relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br p-4 text-white shadow-lg transition-transform duration-200 hover:-translate-y-0.5 ${status.toneClass}`}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_45%)]" />
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-white/80">Status</p>
                  <p className="mt-1 text-base font-semibold">{status.label}</p>
                </div>
                <span className="rounded-full border border-white/30 bg-white/15 p-2 backdrop-blur">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="relative z-10 mt-8">
                <p className="text-xs uppercase tracking-[0.14em] text-white/80">Cards</p>
                <p className="mt-1 text-3xl font-bold leading-none tabular-nums">{count}</p>
              </div>
            </article>
          )
        })}
      </div>
    </DashboardWidgetShell>
  )
}
