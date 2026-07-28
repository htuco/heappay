import { useState } from 'react'
import { Loader2, Send, Star, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import CardBrandIcon from '@/components/ui/CardBrandIcon'
import { Input } from '@/components/ui/input'
import UserAvatar from '@/components/ui/UserAvatar'
import { formatMoney } from '@/utils/amount'
import { formatTransactionDate } from '@/components/payment/transactionHistory.utils'

function SectionLabel({ children, action }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {children}
      </h3>
      {action}
    </div>
  )
}

/**
 * Payment context for the selected contact: the card on file, recent payments,
 * the running yearly total, and the destructive actions that were demoted out
 * of the list row.
 *
 * Keyed on the contact id by its caller, so selecting someone else remounts the
 * panel and drops any half-finished edit or delete confirmation — no reset
 * effect needed. `mode` lets a row's overflow menu open straight into editing or
 * the remove confirmation.
 */
export default function ContactDetailPanel({
  contact,
  payment,
  year,
  isBusy,
  isLoadingPayments,
  mode = 'view',
  onSend,
  onTogglePin,
  onSaveAlias,
  onRemove,
}) {
  const [aliasDraft, setAliasDraft] = useState(contact?.alias ?? '')
  const [isEditing, setIsEditing] = useState(mode === 'edit')
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(mode === 'remove')

  if (!contact) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Users className="size-5 text-muted-foreground/70" aria-hidden />
        <p className="text-sm font-semibold text-foreground">No contact selected</p>
        <p className="max-w-56 text-xs text-muted-foreground">
          Pick someone from the list to see their card on file and your payment history.
        </p>
      </Card>
    )
  }

  const card = contact.default_card
  const recent = payment?.recent ?? []

  function startEdit() {
    setAliasDraft(contact.alias ?? '')
    setIsEditing(true)
  }

  async function saveEdit() {
    const saved = await onSaveAlias(contact, aliasDraft.trim())
    if (saved) setIsEditing(false)
  }

  return (
    <Card className="space-y-5">
      <div className="flex items-start gap-3">
        <UserAvatar user={contact} className="h-11 w-11 shrink-0 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold tracking-tight text-foreground">
            {contact.display_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
        </div>
        <button
          type="button"
          onClick={() => onTogglePin(contact)}
          disabled={isBusy}
          aria-label={contact.is_favorite ? 'Unpin from quick send' : 'Pin to quick send'}
          aria-pressed={contact.is_favorite}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
        >
          <Star className={`size-4 ${contact.is_favorite ? 'fill-primary text-primary' : ''}`} />
        </button>
      </div>

      <Button
        type="button"
        className="w-full"
        disabled={!card}
        title={card ? undefined : 'This contact has no card to receive payments.'}
        onClick={() => onSend(contact)}
      >
        <Send className="size-4" /> Send money
      </Button>

      <div className="space-y-2">
        <SectionLabel>Saved card</SectionLabel>
        {card ? (
          <div className="flex items-center gap-3 rounded-panel border border-border bg-muted/30 px-3 py-2.5">
            <CardBrandIcon brand={card.vendor} width={34} />
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold text-foreground">
                •••• {card.last_four}
              </p>
              <p className="truncate text-xs capitalize text-muted-foreground">
                {card.vendor ?? 'Card'}
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-panel border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            No card saved — this contact can't receive payments yet.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <SectionLabel
          action={
            recent.length > 0 ? (
              <Link
                to="/transactions"
                className="text-xs font-semibold text-primary hover:underline"
              >
                View all
              </Link>
            ) : null
          }
        >
          Recent payments
        </SectionLabel>

        {isLoadingPayments ? (
          <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Loading payments…
          </p>
        ) : recent.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            You haven't sent money to this contact yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {recent.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {tx.note || 'Payment'}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatTransactionDate(tx.at)}</p>
                </div>
                <p className="shrink-0 font-mono text-sm font-semibold text-foreground">
                  {formatMoney(tx.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
          <p className="text-sm font-semibold text-muted-foreground">Sent in {year}</p>
          <p className="font-mono text-sm font-bold text-foreground">
            {formatMoney(payment?.sentThisYear ?? 0)}
          </p>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2 border-t border-border/60 pt-4">
          <label
            htmlFor="contact-alias"
            className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            Alias
          </label>
          <Input
            id="contact-alias"
            value={aliasDraft}
            onChange={(e) => setAliasDraft(e.target.value)}
            placeholder="e.g. Landlord"
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={isBusy} onClick={saveEdit}>
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : isConfirmingRemove ? (
        <div className="space-y-2 border-t border-border/60 pt-4">
          <p className="text-xs text-muted-foreground">
            Remove {contact.display_name} from your contacts? Your payment history stays intact.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isBusy}
              onClick={() => onRemove(contact)}
            >
              {isBusy ? <Loader2 className="size-4 animate-spin" /> : 'Remove'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsConfirmingRemove(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-4">
          <Button type="button" variant="outline" size="sm" onClick={startEdit}>
            Edit details
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setIsConfirmingRemove(true)}
          >
            Remove
          </Button>
        </div>
      )}
    </Card>
  )
}
