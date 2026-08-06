import { Plus } from 'lucide-react'

import UserAvatar from '@/components/ui/UserAvatar'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCompactAmount } from '@/utils/contacts.utils'

/**
 * Pinned contacts as one-tap send targets. A chip starts a payment straight
 * away; the trailing control pins another contact, which is the same
 * `is_favorite` flag the list badges as PINNED.
 */
export default function QuickSendStrip({ pinned, unpinned, payments, onSend, onPin }) {
  const canPin = unpinned.length > 0
  if (pinned.length === 0 && !canPin) return null

  return (
    <section aria-labelledby="quick-send-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="quick-send-heading" className="text-base font-bold tracking-tight text-foreground">
          Quick send
        </h2>
        <p className="text-sm text-muted-foreground">Pinned contacts — one tap to start a payment</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {pinned.map((contact) => {
          const last = formatCompactAmount(payments[contact.user_id]?.lastAmount)
          const payable = Boolean(contact.default_card)
          return (
            <button
              key={contact.contact_id}
              type="button"
              disabled={!payable}
              onClick={() => onSend(contact)}
              title={payable ? undefined : 'This contact has no card to receive payments.'}
              className="flex min-h-11 items-center gap-2.5 rounded-pill border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserAvatar user={contact} className="h-8 w-8 text-[11px]" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight text-foreground">
                  {contact.first_name}
                </span>
                <span className="block truncate text-xs leading-tight text-muted-foreground">
                  {last ? `Last: ${last}` : 'No payments yet'}
                </span>
              </span>
            </button>
          )
        })}

        {canPin && (
          <DropdownMenuRoot>
            <DropdownMenuTrigger className="flex min-h-11 items-center gap-2 rounded-pill border border-dashed border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <Plus className="size-4" /> Pin a contact
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-64">
              <DropdownMenuLabel>Pin to quick send</DropdownMenuLabel>
              {unpinned.map((contact) => (
                <DropdownMenuItem key={contact.contact_id} onSelect={() => onPin(contact)}>
                  <UserAvatar user={contact} className="h-6 w-6 text-[10px]" />
                  <span className="min-w-0 truncate">{contact.display_name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenuRoot>
        )}
      </div>
    </section>
  )
}
