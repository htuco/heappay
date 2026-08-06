import { Link } from 'react-router-dom'
import { ArrowLeft, ChartPie, Construction, ListTree, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'

// What the page will cover once it is built. Listed here so the placeholder
// still tells the user what is coming rather than just "coming soon".
const PLANNED = [
  {
    icon: ChartPie,
    title: 'Full category breakdown',
    body: 'Every spending category, not just the top six the dashboard has room for.',
  },
  {
    icon: TrendingUp,
    title: 'Trends over time',
    body: 'Month-on-month movement per category, with your own date range.',
  },
  {
    icon: ListTree,
    title: 'Drill down to transactions',
    body: 'Open any category or month and see the transactions behind the number.',
  },
]

export default function AnalyticsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <section className="rounded-panel border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="rounded-input border border-border bg-muted p-3 text-primary">
            <Construction className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-card-foreground sm:text-xl">
                Analytics is under construction
              </h2>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              We&apos;re building a dedicated home for your spending insights. Until it lands, the
              dashboard shows your top categories and the transaction list can filter by any one of
              them.
            </p>
          </div>
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {PLANNED.map((item) => {
            // Assigned rather than destructured as `{ icon: Icon }` — this
            // repo's ESLint reads that as an unused argument.
            const Icon = item.icon
            return (
              <li
                key={item.title}
                className="rounded-surface border border-border bg-background p-4"
              >
                <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
                <p className="mt-2 text-sm font-semibold text-card-foreground">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</p>
              </li>
            )
          })}
        </ul>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline" className="w-full gap-1.5 sm:w-auto">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
          <Button asChild className="w-full gap-1.5 sm:w-auto">
            <Link to="/transactions">Browse transactions</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
