import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, FileText, Loader2, Pencil, Send, Trash2 } from 'lucide-react'

import CardBrandIcon from '@/components/ui/CardBrandIcon'
import UserAvatar from '@/components/ui/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  findCategoryById,
  getCategoryMeta,
} from '@/components/payment/transactionHistory.utils'
import { timeAgo } from '@/components/notifications/timeUtils'
import { selectTransactionCategories } from '@/store/slices/referenceDataSlice'
import { useAppSelector } from '@/store/hooks'
import transactionDraftsService from '@/services/transactionDraftsService'
import { DATA_CHANGE_KINDS, subscribeDataChange } from '@/utils/dataEvents'
import { formatMoney } from '@/utils/amount'
import { cn } from '@/lib/utils'

/** A draft's recipient as a person, or null while it has none yet. */
function recipientUser(draft) {
  const recipient = draft.recipient
  if (!recipient) return null
  return {
    first_name: recipient.first_name,
    last_name: recipient.last_name,
    full_name:
      [recipient.first_name, recipient.last_name].filter(Boolean).join(' ') ||
      recipient.cardholder_name ||
      recipient.email,
    avatar_url: recipient.avatar_url,
  }
}

function recipientLabel(draft) {
  return recipientUser(draft)?.full_name || 'No recipient yet'
}

// Same pill a categorised transaction row shows, so a category reads the same
// way here as it will once this draft becomes a real payment.
function CategoryPill({ category }) {
  if (!category) return null
  const meta = getCategoryMeta(category)
  const Icon = meta.icon
  return (
    <span className="inline-flex items-center gap-1.5 rounded-chip border-2 border-border bg-muted px-2 py-0 text-xs font-bold text-muted-foreground">
      <Icon className="size-3" style={{ color: meta.color }} aria-hidden />
      {meta.label}
    </span>
  )
}

function DraftCard({ draft, onResume, onSend, onDiscard }) {
  const categories = useAppSelector(selectTransactionCategories)
  const category = findCategoryById(draft.category_id, categories)
  const person = recipientUser(draft)
  const name = recipientLabel(draft)
  const savedAt = new Date(draft.updated_at).getTime()

  return (
    <div className="relative overflow-hidden rounded-card border border-border bg-card py-3.5 pl-5 pr-4 shadow-sm transition-shadow hover:shadow-md">
      <span className="absolute inset-y-0 left-0 w-1.5 bg-muted-foreground/40" aria-hidden />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {person ? (
            <UserAvatar user={person} className="size-10 text-sm" />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileText className="size-4" />
            </span>
          )}
          <div className="min-w-0">
            <p
              className={cn(
                'truncate font-semibold',
                person ? 'text-card-foreground' : 'text-muted-foreground'
              )}
            >
              {name}
            </p>
            {draft.note && (
              <p className="truncate text-sm text-muted-foreground">{draft.note}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Resume draft payment to ${name}`}
            onClick={() => onResume(draft)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Send draft payment to ${name}`}
            // Nothing to send until it has a recipient and an amount. The
            // server checks this too — this only saves a pointless round trip.
            disabled={!draft.is_sendable}
            onClick={() => onSend(draft)}
          >
            <Send className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            aria-label={`Discard draft payment to ${name}`}
            onClick={() => onDiscard(draft)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p
          className={cn(
            'tabular text-2xl font-bold tracking-tight',
            draft.amount != null ? 'text-card-foreground' : 'text-muted-foreground'
          )}
        >
          {draft.amount != null ? formatMoney(draft.amount) : 'No amount yet'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" size="sm">
            Draft
          </Badge>
          <CategoryPill category={category} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/60 pt-2.5">
        <p className="text-sm text-muted-foreground">Saved {timeAgo(savedAt)}</p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {draft.sender ? (
            <>
              <CardBrandIcon brand={draft.sender.brand} width={30} />
              {draft.sender.last_four ? `···· ${draft.sender.last_four}` : 'Card'}
            </>
          ) : (
            'No card chosen'
          )}
        </p>
      </div>
    </div>
  )
}

/**
 * Drafts are payments the user saved to finish later. They live in their own
 * table server-side, so nothing here is part of the transaction history above
 * it — no draft counts toward a balance, a summary or an export until it is
 * actually sent.
 *
 * Sending reopens the wizard on its confirm step rather than firing straight
 * off: a payment can still need Face ID, an app PIN or a password, and that
 * step-up already lives in the wizard. `onSend` is what the page does with it.
 */
export default function DraftPaymentList({ onResume, onSend }) {
  const [drafts, setDrafts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [draftToDiscard, setDraftToDiscard] = useState(null)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [discardError, setDiscardError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setDrafts(await transactionDraftsService.list())
      setLoadError('')
    } catch (err) {
      setLoadError(err?.message || "Couldn't load your drafts.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(
    () =>
      subscribeDataChange((kind) => {
        if (kind === DATA_CHANGE_KINDS.TRANSACTION_DRAFT) refresh()
      }),
    [refresh]
  )

  async function handleDiscard() {
    if (!draftToDiscard || isDiscarding) return
    setIsDiscarding(true)
    setDiscardError('')
    try {
      await transactionDraftsService.remove(draftToDiscard.draft_id)
      setDraftToDiscard(null)
      await refresh()
    } catch (err) {
      setDiscardError(err?.message || "Couldn't discard this draft. Please try again.")
    } finally {
      setIsDiscarding(false)
    }
  }

  // Nothing saved (and nothing broken) means no section at all — an empty
  // "Drafts" heading above the history would be pure noise.
  if (isLoading || (drafts.length === 0 && !loadError)) return null

  return (
    // Same width constraint the history below uses, so the two sections share
    // an edge instead of the drafts spilling past it.
    <section className="mx-auto mb-6 max-w-5xl" aria-labelledby="payment-drafts-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="payment-drafts-heading"
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
        >
          <FileText className="size-4" />
          Drafts
          {drafts.length > 0 && (
            <Badge variant="secondary" size="sm">
              {drafts.length}
            </Badge>
          )}
        </h2>
      </div>

      {loadError ? (
        <p className="flex items-center gap-2 rounded-card border border-border bg-card px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {loadError}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {drafts.map((draft) => (
            <DraftCard
              key={draft.draft_id}
              draft={draft}
              onResume={onResume}
              onSend={onSend}
              onDiscard={setDraftToDiscard}
            />
          ))}
        </div>
      )}

      <DialogRoot
        open={Boolean(draftToDiscard)}
        onOpenChange={(open) => {
          if (!open) {
            setDraftToDiscard(null)
            setDiscardError('')
          }
        }}
      >
        <DialogContent className="max-w-[27rem] rounded-panel p-0">
          <div className="p-6 sm:p-7">
            <DialogHeader className="mb-0 gap-0 pr-8">
              <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-8 ring-destructive/5">
                <Trash2 className="size-5" />
              </span>
              <DialogTitle className="text-[1.35rem] font-semibold leading-7 tracking-normal text-card-foreground">
                Discard this draft?
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-[22rem] text-sm leading-6 text-muted-foreground">
                {draftToDiscard
                  ? `The saved payment to ${recipientLabel(draftToDiscard)} will be deleted. No money was ever held for it.`
                  : ''}
              </DialogDescription>
            </DialogHeader>

            {discardError && (
              <p className="mt-4 text-xs leading-5 text-destructive" role="alert">
                {discardError}
              </p>
            )}

            <DialogFooter className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DialogClose asChild>
                <Button variant="outline" className="h-11 rounded-input font-semibold">
                  Keep draft
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                className="h-11 rounded-input font-semibold"
                disabled={isDiscarding}
                onClick={handleDiscard}
              >
                {isDiscarding ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {isDiscarding ? 'Discarding…' : 'Discard draft'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </DialogRoot>
    </section>
  )
}
