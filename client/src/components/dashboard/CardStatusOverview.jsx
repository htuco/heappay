import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'

const statusConfig = {
  active: {
    label: 'Active',
    icon: CheckCircle2,
    toneClass: 'from-blue-500 via-indigo-500 to-purple-500',
  },
  blocked: {
    label: 'Blocked',
    icon: AlertTriangle,
    toneClass: 'from-orange-500 via-orange-600 to-red-500',
  },
  reported: {
    label: 'Reported',
    icon: ShieldAlert,
    toneClass: 'from-zinc-700 via-zinc-800 to-rose-900',
  },
}

export default function CardStatusOverview({ totalCards = 0, statusCounts = {} }) {
  const statuses = ['active', 'blocked', 'reported']

  return (
    <section className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Card Portfolio Health
          </p>
          <h2 className="mt-1 text-lg font-semibold sm:text-xl">Card Status Overview</h2>
        </div>
        <div className="rounded-xl border border-border bg-background px-3 py-2 text-right shadow-sm sm:px-4">
          <p className="text-xl font-bold leading-none tabular-nums sm:text-2xl">{totalCards}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">
            Total Cards
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {statuses.map((status) => {
          const config = statusConfig[status]
          const Icon = config.icon
          const count = statusCounts[status] ?? 0

          return (
            <article
              key={status}
              className={`relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br p-4 text-white shadow-lg transition-transform duration-200 hover:-translate-y-0.5 ${config.toneClass}`}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_45%)]" />
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-white/80">Status</p>
                  <p className="mt-1 text-base font-semibold">{config.label}</p>
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
    </section>
  )
}
