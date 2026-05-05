import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react'

const DEFAULT_ITEMS = [
  {
    id: 'act-1',
    title: 'Payment received from Acme Corp',
    timestamp: 'Today, 2:30 PM',
    amount: '+$3,500',
    direction: 'in',
  },
  {
    id: 'act-2',
    title: 'AWS Cloud Services',
    timestamp: 'Yesterday, 4:15 PM',
    amount: '-$289',
    direction: 'out',
  },
  {
    id: 'act-3',
    title: 'Monthly retainer - TechStart',
    timestamp: 'May 2, 10:00 AM',
    amount: '+$5,000',
    direction: 'in',
  },
]

export default function DashboardPlaceholder({
  title = 'Recent Activity',
  items = DEFAULT_ITEMS,
}) {
  return (
    <section className="flex h-full flex-col rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-card-foreground sm:text-lg">{title}</h2>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View All
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </header>

      <ul className="divide-y divide-border/60">
        {items.map((item) => {
          const isIn = item.direction === 'in'
          const Icon = isIn ? ArrowDownLeft : ArrowUpRight
          const iconWrap = isIn
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          const amountColor = isIn
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-rose-600 dark:text-rose-400'
          return (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`shrink-0 rounded-full p-2 ${iconWrap}`}>
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-card-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                </div>
              </div>
              <p className={`tabular shrink-0 text-sm font-semibold ${amountColor}`}>
                {item.amount}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
