import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Wallet,
  X,
  Zap,
} from 'lucide-react'

import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import CardBrandIcon from '@/components/ui/CardBrandIcon'
import FormBanner from '@/components/ui/FormBanner'
import { SegmentedControl } from '@/components/payment/wizardPrimitives'
import { formatMoney, normalizeAmountForSubmit, sanitizeAmountInput } from '@/utils/amount'
import { getCardTail } from '@/utils/cardMask'
import { formatBrandLabel } from '@/utils/paymentCard.utils'

const SUCCESS_HOLD_MS = 1100
const QUICK_AMOUNTS = [25, 50, 100]

const DIRECTION_OPTIONS = [
  {
    value: 'to_card',
    label: (
      <span className="inline-flex items-center justify-center gap-1.5">
        <Wallet className="h-3.5 w-3.5" strokeWidth={2.2} />
        Wallet → Card
      </span>
    ),
  },
  {
    value: 'to_wallet',
    label: (
      <span className="inline-flex items-center justify-center gap-1.5">
        <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={2.2} />
        Card → Wallet
      </span>
    ),
  },
]

/** The design renders card identity as `•••• 0005`, not the full masked PAN. */
function cardTail(card) {
  return getCardTail(card?.card?.cardNumber)
}

function cardLabel(card) {
  return card ? `•••• ${cardTail(card)}` : '—'
}

/** A card can only move what isn't already held against pending outgoing transactions. */
function cardAvailable(card) {
  if (!card) return 0
  const balance = Number(card.balance ?? 0)
  const reserved = Number(card.reserved ?? 0)
  if (!isFinite(balance)) return 0
  return Math.max(0, balance - (isFinite(reserved) ? reserved : 0))
}

const SIDE_BASE =
  'flex min-w-0 flex-1 items-center gap-3 rounded-surface border p-3 text-left transition-colors'

function sideTone(isSource) {
  return isSource ? 'border-primary/30 bg-primary/8' : 'border-border bg-card'
}

function SideRole({ isSource }) {
  return (
    <p className="text-[11px] font-medium text-muted-foreground">{isSource ? 'From' : 'To'}</p>
  )
}

function SideFigure({ isSource, value }) {
  return (
    <p className="truncate text-[11px] text-muted-foreground">
      {isSource ? 'Available' : 'Balance'}{' '}
      <span className="tabular-nums font-semibold text-card-foreground">{formatMoney(value)}</span>
    </p>
  )
}

function WalletSide({ isSource, balance }) {
  return (
    <div className={`${SIDE_BASE} ${sideTone(isSource)}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-primary text-primary-foreground">
        <Wallet className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <SideRole isSource={isSource} />
        <p className="truncate text-sm font-semibold text-card-foreground">Wallet</p>
        <SideFigure isSource={isSource} value={balance} />
      </span>
    </div>
  )
}

/**
 * The card half of the From → To block. It reflects `selectedCardId` rather than
 * owning a second dropdown — the chevron jumps to the card picker below, so there
 * is only ever one selection control to keep in sync.
 */
function CardSide({ isSource, card, pickerId, onJumpToPicker }) {
  if (!card) {
    return (
      <div className={`${SIDE_BASE} border-dashed ${sideTone(isSource)}`}>
        <span className="min-w-0">
          <SideRole isSource={isSource} />
          <p className="truncate text-sm font-semibold text-muted-foreground">No card</p>
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onJumpToPicker}
      aria-controls={pickerId}
      aria-label={`${isSource ? 'Source' : 'Destination'} card ending ${cardTail(card)} — change card`}
      className={`${SIDE_BASE} ${sideTone(isSource)} hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
    >
      <span className="min-w-0 flex-1">
        <SideRole isSource={isSource} />
        <span className="flex items-center gap-2">
          <CardBrandIcon brand={card.card?.brand} width={38} />
          <span className="truncate font-mono text-sm font-semibold text-card-foreground">
            {cardLabel(card)}
          </span>
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.2} />
        </span>
        <SideFigure isSource={isSource} value={isSource ? cardAvailable(card) : card.balance} />
      </span>
    </button>
  )
}

function SummaryRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dashed border-border/70 py-2.5 last:border-b-0 last:pb-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2 text-right text-sm font-semibold text-card-foreground">
        {children}
      </dd>
    </div>
  )
}

/**
 * Move money between the wallet (unallocated funds) and a card. Direction picks
 * the source/destination; the "Available" figure always reflects whichever side
 * is the source so the user can't overshoot.
 */
export default function WalletTransferModal({
  isOpen,
  onClose,
  cards = [],
  walletBalance = 0,
  onTransfer,
  onSuccess,
}) {
  const [direction, setDirection] = useState('to_card')
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [scrollHint, setScrollHint] = useState({ left: false, right: false })

  const amountId = useId()
  const pickerId = useId()
  const pickerLabelId = useId()
  const scrollerRef = useRef(null)
  const selectedTileRef = useRef(null)

  // Only cards that can move money — a frozen card is rejected server-side.
  const eligibleCards = useMemo(
    () => cards.filter((c) => c.card?.status !== 'frozen'),
    [cards]
  )

  useEffect(() => {
    if (!isOpen) return
    if (selectedCardId == null && eligibleCards.length > 0) {
      const main = eligibleCards.find((c) => c.isMain) ?? eligibleCards[0]
      setSelectedCardId(main.id)
    }
  }, [isOpen, eligibleCards, selectedCardId])

  const measureScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setScrollHint({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 })
  }, [])

  // ResizeObserver fires once on observe(), which covers the initial measurement
  // without a synchronous setState in the effect body.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const observer = new ResizeObserver(measureScroll)
    observer.observe(el)
    el.addEventListener('scroll', measureScroll, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', measureScroll)
    }
  }, [measureScroll, isOpen, success, eligibleCards.length])

  function handleClose() {
    setDirection('to_card')
    setSelectedCardId(null)
    setAmount('')
    setError('')
    setSuccess(false)
    onClose()
  }

  const selectedCard = eligibleCards.find((c) => c.id === selectedCardId) ?? null
  const isToCard = direction === 'to_card'
  const amountNum = parseFloat(amount)
  const hasAmount = !isNaN(amountNum) && amountNum > 0
  const availableSource = isToCard ? Number(walletBalance) : cardAvailable(selectedCard)
  const reservedOnCard = Number(selectedCard?.reserved ?? 0)
  const overshoot = !isNaN(amountNum) && amountNum > availableSource + 0.001
  const canSubmit = selectedCard && hasAmount && !overshoot && !isSubmitting

  function applyAmount(value) {
    setAmount(normalizeAmountForSubmit(value) ?? '')
  }

  function jumpToPicker() {
    const tile = selectedTileRef.current
    if (!tile) return
    tile.focus({ preventScroll: true })
    tile.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }

  function scrollPicker(step) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: step * Math.max(168, el.clientWidth * 0.7), behavior: 'smooth' })
  }

  async function handleSubmit() {
    const normalized = normalizeAmountForSubmit(amount)
    if (!selectedCard || !normalized) return
    if (Number(normalized) <= 0 || overshoot || isSubmitting) return

    setError('')
    setIsSubmitting(true)
    try {
      await onTransfer({
        direction,
        cardId: Number(selectedCard.id),
        amount: normalized,
      })
      setSuccess(true)
      onSuccess?.()
      setTimeout(handleClose, SUCCESS_HOLD_MS)
    } catch (err) {
      setError(err?.message || 'Transfer failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Transfer complete" size="xl">
        <div className="flex flex-col items-center gap-5 py-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 ring-8 ring-success/5">
            <Check className="h-8 w-8 text-success" strokeWidth={2.2} />
          </span>
          <div className="space-y-1">
            <p className="tabular-nums text-3xl font-bold tracking-tight text-card-foreground">
              {formatMoney(amountNum)}
            </p>
            <p className="text-sm text-muted-foreground">
              {isToCard ? 'Wallet → Card' : 'Card → Wallet'}
            </p>
          </div>
        </div>
      </Modal>
    )
  }

  const walletSide = <WalletSide isSource={isToCard} balance={walletBalance} />
  const cardSide = (
    <CardSide
      isSource={!isToCard}
      card={selectedCard}
      pickerId={pickerId}
      onJumpToPicker={jumpToPicker}
    />
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Transfer"
      subtitle="Move money between your wallet and cards"
      size="xl"
    >
      <div className="space-y-5">
        <SegmentedControl
          options={DIRECTION_OPTIONS}
          value={direction}
          onChange={setDirection}
          ariaLabel="Transfer direction"
          tone="primary"
        />

        {/* From → To. Stacks below sm, where two boxes plus the arrow don't fit. */}
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {isToCard ? walletSide : cardSide}
          <span
            aria-hidden="true"
            className="flex shrink-0 items-center justify-center gap-1 self-center"
          >
            <span className="hidden w-3 border-t border-dashed border-border sm:block" />
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-card-foreground">
              <ArrowRight className="h-4 w-4 rotate-90 sm:rotate-0" strokeWidth={2.2} />
            </span>
            <span className="hidden w-3 border-t border-dashed border-border sm:block" />
          </span>
          {isToCard ? cardSide : walletSide}
        </div>

        {/* Card picker — the single source of truth for the selection. */}
        <section className="space-y-2">
          <p id={pickerLabelId} className="text-sm font-medium text-card-foreground">
            {isToCard ? 'Destination card' : 'Source card'}
          </p>
          {eligibleCards.length === 0 ? (
            <div className="rounded-surface border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              No eligible cards. Add an active card first.
            </div>
          ) : (
            <div className="relative">
              <div
                ref={scrollerRef}
                id={pickerId}
                role="group"
                aria-labelledby={pickerLabelId}
                className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {eligibleCards.map((c) => {
                  const selected = selectedCardId === c.id
                  return (
                    <button
                      key={c.id}
                      ref={selected ? selectedTileRef : null}
                      type="button"
                      onClick={() => setSelectedCardId(c.id)}
                      aria-pressed={selected}
                      className={`w-42 shrink-0 rounded-surface border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        selected
                          ? 'border-primary bg-primary/8'
                          : 'border-border bg-card hover:border-border/90 hover:bg-muted/40'
                      }`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <CardBrandIcon brand={c.card?.brand} width={44} />
                        <span
                          aria-hidden="true"
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            selected ? 'bg-primary' : 'border border-border bg-background'
                          }`}
                        >
                          {selected && (
                            <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3.5} />
                          )}
                        </span>
                      </span>
                      <span className="mt-2.5 block truncate font-mono text-sm font-semibold text-card-foreground">
                        {cardLabel(c)}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        Balance{' '}
                        <span className="tabular-nums font-semibold text-card-foreground">
                          {formatMoney(c.balance)}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              {scrollHint.left && (
                <button
                  type="button"
                  onClick={() => scrollPicker(-1)}
                  aria-label="Show previous cards"
                  className="absolute left-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-card-foreground shadow-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
                </button>
              )}
              {scrollHint.right && (
                <button
                  type="button"
                  onClick={() => scrollPicker(1)}
                  aria-label="Show more cards"
                  className="absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-card-foreground shadow-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
                </button>
              )}
            </div>
          )}
        </section>

        {/* Amount */}
        <section className="space-y-2">
          <label htmlFor={amountId} className="block text-sm font-medium text-card-foreground">
            Amount
          </label>
          <div
            className={`flex items-center gap-3 rounded-surface border bg-card px-4 py-3 transition-colors focus-within:border-primary/50 ${
              overshoot ? 'border-destructive/60' : 'border-border'
            }`}
          >
            <span className="text-xl font-medium text-muted-foreground" aria-hidden="true">
              $
            </span>
            <input
              id={amountId}
              type="text"
              value={amount}
              onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
              onBlur={() => {
                if (amount) applyAmount(amount)
              }}
              placeholder="0.00"
              inputMode="decimal"
              aria-invalid={overshoot}
              className="min-w-0 flex-1 bg-transparent text-3xl font-bold leading-none tabular-nums tracking-tight text-card-foreground outline-none placeholder:text-muted-foreground/40"
            />
            {amount && (
              <button
                type="button"
                onClick={() => setAmount('')}
                aria-label="Clear amount"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.6} />
              </button>
            )}
            <span className="shrink-0 text-sm font-semibold text-primary" aria-hidden="true">
              USD
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => applyAmount(n)}
                disabled={n > availableSource}
                className="min-h-11 rounded-input border border-border bg-card text-sm font-semibold text-card-foreground transition-colors touch-manipulation hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-card disabled:hover:text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:min-h-9"
              >
                ${n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => applyAmount(availableSource)}
              disabled={availableSource <= 0}
              className="min-h-11 rounded-input border border-primary/40 bg-primary/8 text-sm font-bold text-primary transition-colors touch-manipulation hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:min-h-9"
            >
              MAX
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Available balance:{' '}
            <span className="tabular-nums font-semibold text-primary">
              {formatMoney(availableSource)}
            </span>
          </p>
          {!isToCard && reservedOnCard > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="tabular-nums font-semibold">{formatMoney(reservedOnCard)}</span> is
              held for pending transactions and can't be transferred.
            </p>
          )}
          {overshoot && (
            <p className="text-xs font-medium text-destructive">
              Amount exceeds the available {isToCard ? 'wallet' : 'card'} balance.
            </p>
          )}
        </section>

        {/* Summary — Fee and Processing time are static copy; wallet↔card moves are
            internal, free and immediate. There is no fee engine behind them. */}
        <section className="rounded-surface border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-card-foreground">Summary</h3>
          <dl className="mt-2">
            <SummaryRow label="From">
              {isToCard ? (
                <>
                  Wallet
                  <Wallet className="h-4 w-4 text-muted-foreground" strokeWidth={2.2} />
                </>
              ) : (
                <>
                  <span className="truncate">
                    {formatBrandLabel(selectedCard?.card?.brand)} {cardLabel(selectedCard)}
                  </span>
                  <CardBrandIcon brand={selectedCard?.card?.brand} width={32} />
                </>
              )}
            </SummaryRow>
            <SummaryRow label="To">
              {isToCard ? (
                <>
                  <span className="truncate">
                    {formatBrandLabel(selectedCard?.card?.brand)} {cardLabel(selectedCard)}
                  </span>
                  <CardBrandIcon brand={selectedCard?.card?.brand} width={32} />
                </>
              ) : (
                <>
                  Wallet
                  <Wallet className="h-4 w-4 text-muted-foreground" strokeWidth={2.2} />
                </>
              )}
            </SummaryRow>
            <SummaryRow label="Amount">
              <span className="tabular-nums">{hasAmount ? formatMoney(amountNum) : '—'}</span>
            </SummaryRow>
            <SummaryRow label="Fee">
              <span className="text-success">Free</span>
            </SummaryRow>
            <SummaryRow label="Processing time">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.2} />
              Instant
            </SummaryRow>
          </dl>
        </section>

        {error && <FormBanner variant="error" message={error} />}

        <div className="space-y-3">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-busy={isSubmitting}
            size="lg"
            className="relative h-12 w-full justify-center px-5 text-base"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring…
              </>
            ) : (
              <>
                Transfer{hasAmount ? ` ${formatMoney(amountNum)}` : ''}
                <ArrowRight className="absolute right-5 h-4 w-4" strokeWidth={2.2} />
              </>
            )}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" strokeWidth={2.2} />
            Your funds are secure and encrypted
          </p>
        </div>
      </div>
    </Modal>
  )
}
