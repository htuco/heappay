import { XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import UserAvatar from '@/components/ui/UserAvatar'

export default function DependentCard({ link, onOpenCards, onRevoke, busy = false }) {
  const dependent = link.dependent

  return (
    <div className="rounded-card border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar user={dependent} className="h-10 w-10 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-card-foreground">
              {dependent.first_name} {dependent.last_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">{dependent.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-destructive hover:text-destructive"
          title="Remove family link"
          disabled={busy}
          onClick={() => onRevoke(link)}
        >
          <XCircle className="size-4" />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onOpenCards(link)}>
          Cards
        </Button>
      </div>
    </div>
  )
}
