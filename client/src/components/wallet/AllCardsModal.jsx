import { useState } from 'react'
import { CreditCard, MoreVertical, ShieldCheck, Snowflake, Star, Sun, Trash2 } from 'lucide-react'

import CardBrandIcon from '@/components/ui/CardBrandIcon'
import SplitModal, {
  SplitModalContextLabel,
} from '@/components/ui/SplitModal'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/context/NotificationContext'
import { CATEGORIES } from '@/context/notifications/categories'
import { getApiErrorMessage } from '@/utils/api'
import transactionsService from '@/services/transactionsService'
import { DATA_CHANGE_KINDS, emitDataChange } from '@/utils/dataEvents'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatBrandLabel, formatExpiryDate } from '@/utils/paymentCard.utils'
import { maskCardNumber } from '@/utils/cardMask'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'

const DEFAULT_TRIGGER_CLASS =
  'border-border/80 bg-background/90 shadow-sm hover:bg-muted dark:border-white/20 dark:bg-card/70 dark:hover:border-white/30 dark:hover:bg-card'

const STATUS_LABELS = {
  frozen: 'Frozen',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

function getMaskedNumber(card) {
  if (!card) return ''
  if (card.cardNumber) return card.cardNumber
  return maskCardNumber(card.lastFour ?? card.last_four ?? '', {
    brand: card.brand,
  })
}

function MainBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-chip border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
      <Star className="h-3 w-3 fill-primary" strokeWidth={0} />
      Main
    </span>
  )
}

function WalletCardListItem({ item, onRequestSetMain, onRequestRemove, onRequestFreeze, onRequestUnfreeze }) {
  const { formatMoney } = useDisplayCurrency()
  const card = item.card ?? {}
  const brandLabel = formatBrandLabel(card.brand) || 'Card'
  const maskedNumber = getMaskedNumber(card)
  const expiry = formatExpiryDate(card.expiryDate)
  const balance = formatMoney(item.balance)
  const disabledLabel = card.isDisabled ? STATUS_LABELS[card.status] : null
  const isFrozen = card.status === 'frozen'
  const freezeRequested = Boolean(item.hasPendingFreeze)
  const unfreezeRequested = Boolean(item.hasPendingUnfreeze)
  // Freeze can be requested on any non-frozen card the user owns (including the
  // main one — the card most likely to be lost/stolen). A frozen card can
  // instead request an unfreeze.
  const canFreeze = Boolean(onRequestFreeze) && !isFrozen
  const canUnfreeze = Boolean(onRequestUnfreeze) && isFrozen
  const hasMenu =
    (onRequestSetMain && !item.isMain) ||
    (onRequestRemove && !item.isMain) ||
    canFreeze ||
    canUnfreeze

  const containerClasses = [
    'group relative flex items-center gap-4 rounded-surface border bg-card p-4 transition-colors',
    item.isMain
      ? 'border-primary/40 bg-primary/4'
      : 'border-border/70 hover:border-border',
  ].join(' ')

  return (
    <li className={containerClasses}>
      <div
        className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-input border border-border/70 bg-background"
        aria-hidden="true"
      >
        <CardBrandIcon
          brand={card.brand}
          cardNumber={card.cardNumber}
          width={42}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="whitespace-nowrap text-sm font-semibold text-card-foreground">
            {brandLabel}
          </span>
          <span className="truncate font-mono text-xs text-muted-foreground sm:text-sm">
            {maskedNumber}
          </span>
          {item.isMain && <MainBadge />}
          {disabledLabel && (
            <span className="inline-flex items-center rounded-chip border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-destructive">
              {disabledLabel}
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          {expiry && (
            <span className="tabular">
              Expires{' '}
              <span className="font-medium text-card-foreground">{expiry}</span>
            </span>
          )}
          <span className="tabular">
            Balance{' '}
            <span className="font-medium text-card-foreground">{balance}</span>
          </span>
        </div>
      </div>

      {hasMenu ? (
        <DropdownMenuRoot>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Card actions"
              className="shrink-0 self-center text-muted-foreground hover:text-card-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onRequestSetMain && !item.isMain && !card.isDisabled && (
              <DropdownMenuItem onSelect={() => onRequestSetMain(item)}>
                <Star className="h-4 w-4" />
                Set as main
              </DropdownMenuItem>
            )}
            {canFreeze && (
              <DropdownMenuItem
                disabled={freezeRequested}
                onSelect={() => {
                  if (freezeRequested) return
                  onRequestFreeze(item)
                }}
              >
                <Snowflake className="h-4 w-4" />
                <span className="flex flex-1 flex-col">
                  <span>{freezeRequested ? 'Freeze requested' : 'Request freeze'}</span>
                  {freezeRequested && (
                    <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                      Under review
                    </span>
                  )}
                </span>
              </DropdownMenuItem>
            )}
            {canUnfreeze && (
              <DropdownMenuItem
                disabled={unfreezeRequested}
                onSelect={() => {
                  if (unfreezeRequested) return
                  onRequestUnfreeze(item)
                }}
              >
                <Sun className="h-4 w-4" />
                <span className="flex flex-1 flex-col">
                  <span>{unfreezeRequested ? 'Unfreeze requested' : 'Request unfreeze'}</span>
                  {unfreezeRequested && (
                    <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                      Under review
                    </span>
                  )}
                </span>
              </DropdownMenuItem>
            )}
            {onRequestRemove && !item.isMain && (
              <DropdownMenuItem
                destructive
                disabled={item.hasPending}
                onSelect={() => {
                  if (item.hasPending) return
                  onRequestRemove(item)
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span className="flex flex-1 flex-col">
                  <span>Remove from wallet</span>
                  {item.hasPending && (
                    <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                      Pending transaction
                    </span>
                  )}
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenuRoot>
      ) : (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Card actions"
          disabled
          className="shrink-0 self-center text-muted-foreground"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      )}
    </li>
  )
}

function PrimaryCardSummary({ item }) {
  const { formatMoney } = useDisplayCurrency()
  if (!item) {
    return (
      <div className="rounded-surface border border-dashed border-border bg-card/40 px-4 py-5 text-center text-xs text-muted-foreground">
        No primary card selected yet.
      </div>
    )
  }
  const card = item.card ?? {}
  return (
    <div className="rounded-surface border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-chip border border-border/70 bg-background">
          <CardBrandIcon
            brand={card.brand}
            cardNumber={card.cardNumber}
            width={52}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-card-foreground">
              {formatBrandLabel(card.brand) || 'Card'}
            </p>
            <MainBadge />
          </div>
          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
            {getMaskedNumber(card)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between rounded-chip bg-muted/50 px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Balance
        </span>
        <span className="tabular text-sm font-bold text-card-foreground">
          {formatMoney(item.balance)}
        </span>
      </div>
    </div>
  )
}

function AllCardsLeftPanel({ cards, primaryCard }) {
  const { formatMoney } = useDisplayCurrency()
  const totalBalance = cards.reduce(
    (sum, item) => sum + (Number(item.balance) || 0),
    0
  )

  return (
    <>
      <p className="text-xs font-bold uppercase tracking-widest text-foreground/70">
        Wallet
      </p>

      <div className="flex flex-1 flex-col gap-4">
        <div className="space-y-2">
          <SplitModalContextLabel>Primary card</SplitModalContextLabel>
          <PrimaryCardSummary item={primaryCard} />
        </div>

        <div className="rounded-surface border border-border bg-card p-4 shadow-sm">
          <SplitModalContextLabel>Total across cards</SplitModalContextLabel>
          <p className="mt-2 tabular text-2xl font-bold tracking-tight text-card-foreground">
            {formatMoney(totalBalance)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {cards.length} {cards.length === 1 ? 'card' : 'cards'} in your
            wallet
          </p>
        </div>

        <div className="mt-auto rounded-surface border border-border/60 bg-card/60 p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Your primary card is used by default for new payments. You can
            change it any time.
          </p>
        </div>
      </div>
    </>
  )
}

function RemoveCardConfirmDialog({ isOpen, onClose, onConfirm, candidate, isSubmitting }) {
  const { formatMoney } = useDisplayCurrency()
  if (!candidate) return null
  const candidateCard = candidate.card ?? {}
  const candidateLabel = formatBrandLabel(candidateCard.brand) || 'this card'
  const candidateMasked = getMaskedNumber(candidateCard)
  const candidateBalance = formatMoney(candidate.balance)
  const hasBalance = Number(candidate.balance) > 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Remove card from wallet?"
      subtitle="This card will be detached from your wallet. You can add it again later."
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-surface border border-destructive/30 bg-destructive/5 p-3">
          <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-chip border border-border/70 bg-background">
            <CardBrandIcon
              brand={candidateCard.brand}
              cardNumber={candidateCard.cardNumber}
              width={36}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-card-foreground">
              {candidateLabel}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {candidateMasked}
            </p>
          </div>
        </div>

        {hasBalance && (
          <div className="rounded-surface border border-primary/30 bg-primary/5 p-3.5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-card-foreground">
                  Your balance is safe
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  We&apos;ll keep your{' '}
                  <span className="font-semibold text-card-foreground">
                    {candidateBalance}
                  </span>{' '}
                  balance on file. Add this card back any time to restore it
                  to your wallet.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-card-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isSubmitting ? 'Removing…' : 'Remove card'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function FreezeCardConfirmDialog({ isOpen, onClose, onConfirm, candidate, isSubmitting, reason, onReasonChange }) {
  if (!candidate) return null
  const candidateCard = candidate.card ?? {}
  const candidateLabel = formatBrandLabel(candidateCard.brand) || 'this card'
  const candidateMasked = getMaskedNumber(candidateCard)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request a card freeze?"
      subtitle="We'll review your request and freeze this card to block new payments. Use this if your card is lost or stolen."
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-surface border border-warning/30 bg-warning/5 p-3">
          <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-chip border border-border/70 bg-background">
            <CardBrandIcon
              brand={candidateCard.brand}
              cardNumber={candidateCard.cardNumber}
              width={36}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-card-foreground">
              {candidateLabel}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {candidateMasked}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="freeze-reason" className="text-xs font-medium text-muted-foreground">
            Reason <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <textarea
            id="freeze-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value.slice(0, 255))}
            placeholder="e.g. Card lost or stolen, suspicious activity…"
            rows={3}
            maxLength={255}
            className="w-full resize-none rounded-input border border-border bg-background px-3 py-2 text-sm text-card-foreground placeholder:text-muted-foreground/50 shadow-none focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-card-foreground"
          >
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
            <Snowflake className="h-3.5 w-3.5" />
            {isSubmitting ? 'Requesting…' : 'Request freeze'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function UnfreezeCardConfirmDialog({ isOpen, onClose, onConfirm, candidate, isSubmitting }) {
  if (!candidate) return null
  const candidateCard = candidate.card ?? {}
  const candidateLabel = formatBrandLabel(candidateCard.brand) || 'this card'
  const candidateMasked = getMaskedNumber(candidateCard)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request to unfreeze this card?"
      subtitle="We'll review your request and reactivate this card so it can send and receive money again."
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-surface border border-primary/30 bg-primary/5 p-3">
          <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-chip border border-border/70 bg-background">
            <CardBrandIcon brand={candidateCard.brand} cardNumber={candidateCard.cardNumber} width={36} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-card-foreground">{candidateLabel}</p>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{candidateMasked}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="text-card-foreground">
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
            <Sun className="h-3.5 w-3.5" />
            {isSubmitting ? 'Requesting…' : 'Request unfreeze'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function SetMainConfirmDialog({ isOpen, onClose, onConfirm, candidate, currentPrimary, isSubmitting }) {
  if (!candidate) return null
  const candidateCard = candidate.card ?? {}
  const candidateLabel = formatBrandLabel(candidateCard.brand) || 'this card'
  const candidateMasked = getMaskedNumber(candidateCard)
  const currentCard = currentPrimary?.card
  const currentLabel = currentCard
    ? formatBrandLabel(currentCard.brand) || 'your current primary card'
    : null
  const currentMasked = currentCard ? getMaskedNumber(currentCard) : null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Set as main card?"
      subtitle="The main card is used by default for new payments."
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-surface border border-primary/30 bg-primary/4 p-3">
          <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-chip border border-border/70 bg-background">
            <CardBrandIcon
              brand={candidateCard.brand}
              cardNumber={candidateCard.cardNumber}
              width={36}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-card-foreground">
              {candidateLabel}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {candidateMasked}
            </p>
          </div>
        </div>

        {currentLabel && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-card-foreground">{currentLabel}</span>
            <span className="ml-1 font-mono">{currentMasked}</span>
            <span> will no longer be your main card.</span>
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-card-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            <Star className="h-3.5 w-3.5" />
            {isSubmitting ? 'Setting…' : 'Set as main'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function AllCardsModal({
  items = [],
  triggerLabel = 'See All Cards',
  triggerClassName,
  triggerVariant = 'outline',
  onSetMain,
  onRemove,
  addCardSlot,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [pendingMainCard, setPendingMainCard] = useState(null)
  const [pendingRemoveCard, setPendingRemoveCard] = useState(null)
  const [pendingFreezeCard, setPendingFreezeCard] = useState(null)
  const [freezeReason, setFreezeReason] = useState('')
  const [pendingUnfreezeCard, setPendingUnfreezeCard] = useState(null)
  const [isSubmittingMain, setIsSubmittingMain] = useState(false)
  const [isSubmittingRemove, setIsSubmittingRemove] = useState(false)
  const [isSubmittingFreeze, setIsSubmittingFreeze] = useState(false)
  const [isSubmittingUnfreeze, setIsSubmittingUnfreeze] = useState(false)
  const { notify } = useNotifications()

  const cards = Array.isArray(items) ? items : []
  const primaryCard = cards.find((item) => item.isMain) ?? null

  function describeCard(item) {
    const card = item?.card ?? {}
    const brand = formatBrandLabel(card.brand) || 'Card'
    const masked = getMaskedNumber(card)
    const tail = masked ? masked.slice(-4) : ''
    return tail ? `${brand} •••• ${tail}` : brand
  }

  function openModal() {
    setIsOpen(true)
  }

  function closeModal() {
    setIsOpen(false)
  }

  function requestSetMain(item) {
    setPendingMainCard(item)
  }

  function cancelSetMain() {
    if (isSubmittingMain) return
    setPendingMainCard(null)
  }

  async function confirmSetMain() {
    if (!pendingMainCard || !onSetMain) {
      setPendingMainCard(null)
      return
    }
    const label = describeCard(pendingMainCard)
    try {
      setIsSubmittingMain(true)
      await Promise.resolve(onSetMain(Number(pendingMainCard.id)))
      setPendingMainCard(null)
      notify({
        type: 'success',
        category: CATEGORIES.SYSTEM,
        message: `${label} is now your main card.`,
        link: { route: '/wallet', modal: { kind: 'card', id: Number(pendingMainCard.id) } },
      })
    } catch (err) {
      notify({
        type: 'error',
        message: getApiErrorMessage(err, 'Unable to set main card.'),
      })
    } finally {
      setIsSubmittingMain(false)
    }
  }

  function requestRemove(item) {
    setPendingRemoveCard(item)
  }

  function cancelRemove() {
    if (isSubmittingRemove) return
    setPendingRemoveCard(null)
  }

  async function confirmRemove() {
    if (!pendingRemoveCard || !onRemove) {
      setPendingRemoveCard(null)
      return
    }
    const label = describeCard(pendingRemoveCard)
    try {
      setIsSubmittingRemove(true)
      await Promise.resolve(onRemove(Number(pendingRemoveCard.id)))
      setPendingRemoveCard(null)
      notify({
        type: 'success',
        category: CATEGORIES.SYSTEM,
        message: `${label} removed from your wallet.`,
        link: { route: '/wallet' },
      })
    } catch (err) {
      notify({
        type: 'error',
        message: getApiErrorMessage(err, 'Unable to remove card.'),
      })
    } finally {
      setIsSubmittingRemove(false)
    }
  }

  function requestFreeze(item) {
    setFreezeReason('')
    setPendingFreezeCard(item)
  }

  function cancelFreeze() {
    if (isSubmittingFreeze) return
    setPendingFreezeCard(null)
  }

  async function confirmFreeze() {
    if (!pendingFreezeCard) {
      setPendingFreezeCard(null)
      return
    }
    const label = describeCard(pendingFreezeCard)
    try {
      setIsSubmittingFreeze(true)
      await transactionsService.requestCardFreeze(
        Number(pendingFreezeCard.id),
        freezeReason.trim() || null,
      )
      setPendingFreezeCard(null)
      // Refresh wallet cards so the action flips to "Freeze requested".
      emitDataChange(DATA_CHANGE_KINDS.CARD)
      notify({
        type: 'success',
        category: CATEGORIES.SYSTEM,
        message: `Freeze requested for ${label}. Our team will review it shortly.`,
        link: { route: '/wallet' },
      })
    } catch (err) {
      notify({
        type: 'error',
        message: getApiErrorMessage(err, 'Unable to request a freeze for this card.'),
      })
    } finally {
      setIsSubmittingFreeze(false)
    }
  }

  function requestUnfreeze(item) {
    setPendingUnfreezeCard(item)
  }

  function cancelUnfreeze() {
    if (isSubmittingUnfreeze) return
    setPendingUnfreezeCard(null)
  }

  async function confirmUnfreeze() {
    if (!pendingUnfreezeCard) {
      setPendingUnfreezeCard(null)
      return
    }
    const label = describeCard(pendingUnfreezeCard)
    try {
      setIsSubmittingUnfreeze(true)
      await transactionsService.requestCardUnfreeze(Number(pendingUnfreezeCard.id))
      setPendingUnfreezeCard(null)
      emitDataChange(DATA_CHANGE_KINDS.CARD)
      notify({
        type: 'success',
        category: CATEGORIES.SYSTEM,
        message: `Unfreeze requested for ${label}. Our team will review it shortly.`,
        link: { route: '/wallet' },
      })
    } catch (err) {
      notify({
        type: 'error',
        message: getApiErrorMessage(err, 'Unable to request an unfreeze for this card.'),
      })
    } finally {
      setIsSubmittingUnfreeze(false)
    }
  }

  return (
    <>
      <Button
        variant={triggerVariant}
        onClick={openModal}
        className={triggerClassName ?? DEFAULT_TRIGGER_CLASS}
      >
        <CreditCard />
        {triggerLabel}
      </Button>

      <SplitModal
        isOpen={isOpen}
        onClose={closeModal}
        eyebrow="Wallet Cards"
        title="Your Cards"
        className="max-w-4xl"
        gridCols="md:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]"
        leftPanel={<AllCardsLeftPanel cards={cards} primaryCard={primaryCard} />}
        footer={
          addCardSlot ? (
            <>
              <p className="text-xs text-muted-foreground">
                Add another card to expand your wallet.
              </p>
              <div className="shrink-0 *:w-full sm:*:w-auto">{addCardSlot}</div>
            </>
          ) : null
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Manage your wallet cards and primary payment method.
          </p>

          {cards.length === 0 ? (
            <div className="rounded-surface border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              You haven&apos;t added any cards yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {cards.map((item) => (
                <WalletCardListItem
                  key={item.id}
                  item={item}
                  onRequestSetMain={onSetMain ? requestSetMain : null}
                  onRequestRemove={onRemove ? requestRemove : null}
                  onRequestFreeze={requestFreeze}
                  onRequestUnfreeze={requestUnfreeze}
                />
              ))}
            </ul>
          )}
        </div>
      </SplitModal>

      <SetMainConfirmDialog
        isOpen={Boolean(pendingMainCard)}
        onClose={cancelSetMain}
        onConfirm={confirmSetMain}
        candidate={pendingMainCard}
        currentPrimary={primaryCard}
        isSubmitting={isSubmittingMain}
      />

      <RemoveCardConfirmDialog
        isOpen={Boolean(pendingRemoveCard)}
        onClose={cancelRemove}
        onConfirm={confirmRemove}
        candidate={pendingRemoveCard}
        isSubmitting={isSubmittingRemove}
      />

      <FreezeCardConfirmDialog
        isOpen={Boolean(pendingFreezeCard)}
        onClose={cancelFreeze}
        onConfirm={confirmFreeze}
        candidate={pendingFreezeCard}
        isSubmitting={isSubmittingFreeze}
        reason={freezeReason}
        onReasonChange={setFreezeReason}
      />

      <UnfreezeCardConfirmDialog
        isOpen={Boolean(pendingUnfreezeCard)}
        onClose={cancelUnfreeze}
        onConfirm={confirmUnfreeze}
        candidate={pendingUnfreezeCard}
        isSubmitting={isSubmittingUnfreeze}
      />
    </>
  )
}
