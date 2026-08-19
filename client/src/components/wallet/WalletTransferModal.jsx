import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, ArrowRight, Check, Loader2, Wallet } from 'lucide-react'

import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import FormBanner from '@/components/ui/FormBanner'
import { normalizeAmountForSubmit, sanitizeAmountInput } from '@/utils/amount'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'

const SUCCESS_HOLD_MS = 1100

const DIRECTIONS = [
  { key: 'to_card', label: 'Wallet → Card', hint: 'Move funds onto a card to spend' },
  { key: 'to_wallet', label: 'Card → Wallet', hint: 'Pull funds back into your wallet' },
]

/**
 * Move money between the wallet (unallocated funds) and a card. Direction picks
 * the source/destination; the "Available" hint reflects whichever side is the
 * source so the user can't overshoot.
 */
export default function WalletTransferModal({
  isOpen,
  onClose,
  cards = [],
  walletBalance = 0,
  onTransfer,
  onSuccess,
}) {
  const { formatMoney } = useDisplayCurrency()
  const [direction, setDirection] = useState('to_card')
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const amountInputRef = useRef(null)

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

  function handleClose() {
    setDirection('to_card')
    setSelectedCardId(null)
    setAmount('')
    setError('')
    setSuccess(false)
    onClose()
  }

  const selectedCard = eligibleCards.find((c) => c.id === selectedCardId) ?? null
  const amountNum = parseFloat(amount)
  const availableSource =
    direction === 'to_card' ? Number(walletBalance) : Number(selectedCard?.balance ?? 0)
  const overshoot = !isNaN(amountNum) && amountNum > availableSource + 0.001
  const canSubmit =
    selectedCard &&
    !isNaN(amountNum) &&
    amountNum > 0 &&
    !overshoot &&
    !isSubmitting

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
      <Modal isOpen={isOpen} onClose={handleClose} title="" size="default">
        <div className="flex flex-col items-center gap-5 py-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 ring-8 ring-success/5">
            <Check className="h-8 w-8 text-success" strokeWidth={2.2} />
          </span>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Transfer complete
            </p>
            <p className="tabular-nums text-3xl font-bold tracking-tight text-card-foreground">
              {formatMoney(amountNum)}
            </p>
            <p className="text-sm text-muted-foreground">
              {direction === 'to_card' ? 'Wallet → Card' : 'Card → Wallet'}
            </p>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Transfer funds"
      subtitle="Move money between your wallet and a card"
      size="lg"
    >
      <div className="space-y-5 p-1">
        {/* Direction */}
        <div className="grid grid-cols-2 gap-2">
          {DIRECTIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDirection(d.key)}
              aria-pressed={direction === d.key}
              className={`rounded-surface border-2 p-3 text-left transition-colors ${
                direction === d.key
                  ? 'border-primary/60 bg-primary/8'
                  : 'border-border bg-card hover:border-border/90 hover:bg-muted/40'
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-card-foreground">
                {d.key === 'to_card' ? (
                  <Wallet className="h-3.5 w-3.5" strokeWidth={2.2} />
                ) : (
                  <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                )}
                {d.label}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{d.hint}</span>
            </button>
          ))}
        </div>

        {/* Card select */}
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
            {direction === 'to_card' ? 'Destination card' : 'Source card'}
          </p>
          {eligibleCards.length === 0 ? (
            <div className="rounded-surface border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
              No eligible cards. Add an active card first.
            </div>
          ) : (
            <div className="max-h-48 space-y-2 overflow-y-auto pr-0.5">
              {eligibleCards.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCardId(c.id)}
                  aria-pressed={selectedCardId === c.id}
                  className={`flex w-full items-center justify-between gap-3 rounded-surface border-2 p-3 text-left transition-colors ${
                    selectedCardId === c.id
                      ? 'border-primary/60 bg-primary/8'
                      : 'border-border bg-card hover:border-border/90 hover:bg-muted/40'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-sm font-semibold text-card-foreground">
                      {c.card?.cardNumber ?? '—'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Balance{' '}
                      <span className="tabular-nums font-semibold text-card-foreground">
                        {formatMoney(c.balance)}
                      </span>
                    </span>
                  </span>
                  {selectedCardId === c.id ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={3} />
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Amount */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label
              htmlFor="wallet-transfer-amount"
              className="text-xs font-semibold uppercase tracking-wider text-foreground/80"
            >
              Amount
            </label>
            <span className="text-[11px] font-medium text-muted-foreground">
              Available{' '}
              <span className="tabular-nums font-semibold text-foreground/80">
                {formatMoney(availableSource)}
              </span>
            </span>
          </div>
          <div className="rounded-panel bg-muted/50 px-5 py-5 ring-1 ring-border/60">
            <label
              htmlFor="wallet-transfer-amount"
              className="mx-auto flex w-fit items-baseline justify-center gap-1.5 cursor-text"
            >
              <span className="text-2xl font-light leading-none text-foreground/60" aria-hidden>
                $
              </span>
              <input
                ref={amountInputRef}
                id="wallet-transfer-amount"
                type="text"
                value={amount}
                onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
                onBlur={() => {
                  const n = normalizeAmountForSubmit(amount)
                  if (n) setAmount(n)
                }}
                placeholder="0.00"
                inputMode="decimal"
                aria-invalid={overshoot}
                size={Math.max(4, (amount || '0.00').length)}
                className="min-w-[3ch] bg-transparent text-center text-4xl font-bold leading-none tabular-nums tracking-tight outline-none placeholder:text-muted-foreground/40 text-card-foreground"
              />
            </label>
          </div>
          {overshoot ? (
            <p className="text-xs font-medium text-destructive">
              Amount exceeds the available {direction === 'to_card' ? 'wallet' : 'card'} balance.
            </p>
          ) : null}
        </section>

        {error ? <FormBanner variant="error" message={error} /> : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} aria-busy={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transferring…
              </>
            ) : (
              <>
                Transfer
                <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2.2} />
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
