import { MoreHorizontal, Pencil, Send, Star, StarOff, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import CardBrandIcon from '@/components/ui/CardBrandIcon'
import UserAvatar from '@/components/ui/UserAvatar'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatMoney } from '@/utils/amount'
import { formatRelativeDate } from '@/utils/contacts.utils'

/**
 * One contact in the directory. Send is the row's primary action and is always
 * visible; editing and removing are demoted into the overflow menu so they
 * don't compete with it. The middle columns answer "how do I pay this person,
 * and when did I last do it".
 */
export default function ContactRow({
  contact,
  payment,
  isSelected,
  isBusy,
  onSelect,
  onSend,
  onTogglePin,
  onEdit,
  onRemove,
}) {
  const card = contact.default_card
  const lastPaid = formatRelativeDate(payment?.lastAt)

  return (
    <div
      className={`relative flex items-center gap-3 border-b border-border/60 px-3 py-3 transition-colors last:border-b-0 sm:px-4 ${
        isSelected ? 'bg-primary/5' : 'hover:bg-muted/40'
      }`}
    >
      {isSelected && (
        <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" aria-hidden />
      )}

      {/* Selecting a contact loads the detail panel; the row itself is a button
          so the whole strip is clickable, with the real actions layered above. */}
      <button
        type="button"
        onClick={() => onSelect(contact)}
        aria-pressed={isSelected}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <UserAvatar user={contact} className="h-9 w-9 shrink-0 text-xs" />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {contact.display_name}
            </span>
            {contact.is_favorite && (
              <span className="shrink-0 rounded-chip bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                Pinned
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{contact.email}</span>
        </span>

        <span className="hidden w-32 shrink-0 items-center gap-2 md:flex">
          {card ? (
            <>
              <CardBrandIcon brand={card.vendor} width={28} />
              <span className="font-mono text-xs text-muted-foreground">•••• {card.last_four}</span>
            </>
          ) : (
            <span className="font-mono text-xs text-muted-foreground/70">No card saved</span>
          )}
        </span>

        <span className="hidden w-28 shrink-0 text-right sm:block">
          {payment?.lastAmount != null ? (
            <>
              <span className="block text-sm font-semibold text-foreground">
                {formatMoney(payment.lastAmount)}
              </span>
              <span className="block text-xs text-muted-foreground">{lastPaid}</span>
            </>
          ) : (
            <>
              <span className="block text-sm text-muted-foreground">—</span>
              <span className="block text-xs text-muted-foreground">Never paid</span>
            </>
          )}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!card}
          title={card ? undefined : 'This contact has no card to receive payments.'}
          onClick={() => onSend(contact)}
        >
          <Send className="size-4" /> Send
        </Button>

        <DropdownMenuRoot>
          <DropdownMenuTrigger
            aria-label={`More actions for ${contact.display_name}`}
            disabled={isBusy}
            className="inline-flex h-11 w-11 items-center justify-center rounded-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 md:h-8 md:w-8"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onTogglePin(contact)}>
              {contact.is_favorite ? <StarOff /> : <Star />}
              {contact.is_favorite ? 'Unpin from quick send' : 'Pin to quick send'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit(contact)}>
              <Pencil /> Edit details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => onRemove(contact)}>
              <Trash2 /> Remove contact
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuRoot>
      </div>
    </div>
  )
}
