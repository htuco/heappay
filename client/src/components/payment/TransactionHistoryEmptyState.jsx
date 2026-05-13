import { CalendarClock } from 'lucide-react'

export default function TransactionHistoryEmptyState({
  title = 'No transactions yet',
  message = 'Once payments or transfers exist for your cards, they will appear here as your history.',
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <CalendarClock className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-card-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {message}
      </p>
    </div>
  )
}
