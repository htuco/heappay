import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, Check, CheckCircle2, Loader2 } from 'lucide-react'
import SplitModal, {
  SplitModalContextLabel,
} from '@/components/ui/SplitModal'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import FormBanner from '@/components/ui/FormBanner'
import { useAuth } from '@/hooks/useAuth'
import { useCardBrandResolver } from '@/hooks/useCardBrandResolver'
import { formatBrandLabel } from '@/utils/paymentCard.utils'
import CardBrandIcon from '@/components/ui/CardBrandIcon'
import { useNotifications } from '@/context/NotificationContext'
import { CATEGORIES } from '@/context/notifications/categories'
import { listCards } from '@/services/cardsService'
import transactionTypesService from '@/services/transactionTypesService'
import transactionsService from '@/services/transactionsService'
import { DATA_CHANGE_KINDS, emitDataChange } from '@/utils/dataEvents'
import { createIdempotencyKey } from '@/utils/idempotency'

const QUICK_AMOUNTS = [10, 25, 50, 100]
const SUCCESS_HOLD_MS = 1200

function formatAmount(value) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('')
  if (parts[1]?.length > 2) return parts[0] + '.' + parts[1].slice(0, 2)
  return cleaned
}

function formatMoney(value) {
  const n = Number(value)
  if (!isFinite(n)) return '$0.00'
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function FieldLabel({ htmlFor, children, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold uppercase tracking-wider text-foreground/80"
      >
        {children}
      </label>
      {hint && (
        <span className="text-[11px] font-medium text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  )
}

function CardOption({ card, selected, onSelect, maskCard, resolveBrand }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative box-border block w-full rounded-surface border-2 p-3.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        selected
          ? 'border-primary/60 bg-primary/8 shadow-sm'
          : 'border-border bg-card hover:border-border/90 hover:bg-muted/40'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-chip border border-border/70 bg-background">
          <CardBrandIcon brand={resolveBrand(card.card_type_id)} width={52} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-semibold text-card-foreground">
            {maskCard(card)}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            <span className="capitalize font-medium text-muted-foreground">
              {formatBrandLabel(resolveBrand(card.card_type_id))}
            </span>
            <span aria-hidden="true" className="text-muted-foreground/50">
              •
            </span>
            <span className="tabular-nums font-semibold text-card-foreground">
              {formatMoney(card.balance)}
            </span>
          </div>
        </div>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
            selected ? 'bg-primary' : 'border border-border bg-background'
          }`}
          aria-hidden="true"
        >
          {selected && (
            <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3.5} />
          )}
        </span>
      </div>
    </button>
  )
}

function ContextCardPreview({ card, maskCard, resolveBrand, placeholder }) {
  if (!card) {
    return (
      <div className="rounded-surface border border-dashed border-border bg-card/40 px-4 py-5 text-center text-xs text-muted-foreground">
        {placeholder ?? 'No card selected yet.'}
      </div>
    )
  }
  return (
    <div className="rounded-surface border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-chip border border-border/70 bg-background">
          <CardBrandIcon brand={resolveBrand(card.card_type_id)} width={52} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-semibold text-card-foreground">
            {maskCard(card)}
          </p>
          <p className="mt-0.5 text-xs font-medium capitalize text-muted-foreground">
            {formatBrandLabel(resolveBrand(card.card_type_id))}
          </p>
        </div>
      </div>
      {typeof card.balance !== 'undefined' && (
        <div className="mt-3 flex items-baseline justify-between rounded-chip bg-muted/50 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Current balance
          </span>
          <span className="tabular-nums text-sm font-bold text-card-foreground">
            {formatMoney(card.balance)}
          </span>
        </div>
      )}
    </div>
  )
}

function TopUpLeftPanel({
  selectedCard,
  amountNum,
  maskCard,
  resolveBrand,
}) {
  const hasAmount = !isNaN(amountNum) && amountNum > 0
  const projectedBalance = selectedCard
    ? Number(selectedCard.balance) + (hasAmount ? amountNum : 0)
    : null

  return (
    <>
      <p className="text-xs font-bold uppercase tracking-widest text-foreground/70">
        Top Up
      </p>

      <div className="flex flex-1 flex-col gap-4">
        <div className="space-y-2">
          <SplitModalContextLabel>Selected card</SplitModalContextLabel>
          <ContextCardPreview
            card={selectedCard}
            maskCard={maskCard}
            resolveBrand={resolveBrand}
            placeholder="Choose a card on the right to top up."
          />
        </div>

        <div className="rounded-surface border border-border bg-card p-4 shadow-sm">
          <SplitModalContextLabel>You're adding</SplitModalContextLabel>
          <p
            className={`mt-2 tabular-nums text-2xl font-bold tracking-tight ${
              hasAmount ? 'text-card-foreground' : 'text-muted-foreground/60'
            }`}
          >
            {hasAmount ? `+${formatMoney(amountNum)}` : '$0.00'}
          </p>
          {selectedCard && projectedBalance !== null && (
            <p className="mt-1 text-xs text-muted-foreground">
              New balance{' '}
              <span className="font-semibold text-foreground/80 tabular-nums">
                {formatMoney(projectedBalance)}
              </span>
            </p>
          )}
        </div>

        <div className="mt-auto rounded-surface border border-border/60 bg-card/60 p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Funds will be available on the selected card as soon as the deposit
            is processed.
          </p>
        </div>
      </div>
    </>
  )
}

function SuccessState({ amount, cardLastFour, onClose }) {
  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <span className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-success/20 opacity-75" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-success/15 ring-8 ring-success/5">
          <CheckCircle2 className="h-10 w-10 text-success" strokeWidth={1.8} />
        </span>
      </span>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Funds added
        </p>
        <p className="tabular-nums text-4xl font-bold tracking-tight text-card-foreground sm:text-5xl">
          {formatMoney(amount)}
        </p>
        {cardLastFour && (
          <p className="text-sm text-muted-foreground">
            to card ****{cardLastFour}
          </p>
        )}
      </div>

      <Button variant="outline" onClick={onClose} className="w-full">
        Done
      </Button>
    </div>
  )
}

export default function TopUpModal({
  isOpen,
  onClose,
  onSuccess,
  initialCardId = null,
}) {
  const { user } = useAuth()
  const { notify } = useNotifications()
  const { maskCard, resolveBrand } = useCardBrandResolver()

  const [cards, setCards] = useState([])
  const [depositTypeId, setDepositTypeId] = useState(null)
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const amountInputRef = useRef(null)
  const idempotencyKeyRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !user) return
    setIsLoading(true)
    Promise.all([
      listCards({ user_id: user.id, limit: 100 }),
      transactionTypesService.list(),
    ])
      .then(([raw, types]) => {
        const active = raw.filter((c) => !c.deleted_at)
        setCards(active)
        if (initialCardId && active.some((c) => c.card_id === initialCardId)) {
          setSelectedCardId(initialCardId)
        } else if (active.length === 1) {
          setSelectedCardId(active[0].card_id)
        }
        const deposit = types.find((t) => t.name === 'deposit')
        setDepositTypeId(deposit?.transaction_type_id ?? null)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [isOpen, user, initialCardId])

  function handleClose() {
    setSelectedCardId(null)
    setAmount('')
    setError('')
    setSuccess(null)
    idempotencyKeyRef.current = null
    onClose()
  }

  async function handleSubmit() {
    const amountNum = parseFloat(amount)
    if (!selectedCardId || isNaN(amountNum) || amountNum <= 0) return
    if (!depositTypeId) {
      setError('Deposit is not available right now. Please try again later.')
      return
    }
    if (isSubmitting) return

    setError('')
    setIsSubmitting(true)

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = createIdempotencyKey()
    }

    try {
      const card = cards.find((c) => c.card_id === selectedCardId)
      const created = await transactionsService.create({
        sender_card_id: null,
        recipient_card_id: selectedCardId,
        transaction_type_id: depositTypeId,
        amount: amountNum.toFixed(2),
        note: null,
        idempotency_key: idempotencyKeyRef.current,
      })

      notify({
        type: 'success',
        category: CATEGORIES.PAYMENT_RECEIVED,
        message: `${formatMoney(amountNum)} added to card ****${card.last_four}.`,
        link: created?.transaction_id
          ? { route: '/payments', modal: { kind: 'transaction', id: created.transaction_id } }
          : { route: '/payments' },
      })
      emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
      onSuccess?.()
      setSuccess({ amount: amountNum, cardLastFour: card.last_four })
      setTimeout(handleClose, SUCCESS_HOLD_MS)
    } catch (err) {
      setError(err?.message || 'Top-up failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function applyQuickAmount(n) {
    setAmount(n.toFixed(2))
    amountInputRef.current?.focus()
  }

  const selectedCard = cards.find((c) => c.card_id === selectedCardId) ?? null
  const amountNum = parseFloat(amount)
  const amountInvalid = amount !== '' && (isNaN(amountNum) || amountNum <= 0)
  const canSubmit =
    selectedCardId && !isNaN(amountNum) && amountNum > 0 && !isSubmitting

  // Success state uses the classic Modal shell — no split needed.
  if (success) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="" size="default">
        <SuccessState
          amount={success.amount}
          cardLastFour={success.cardLastFour}
          onClose={handleClose}
        />
      </Modal>
    )
  }

  return (
    <SplitModal
      isOpen={isOpen}
      onClose={handleClose}
      size="2xl"
      eyebrow="Add funds"
      title="Top up a card"
      leftPanel={
        <TopUpLeftPanel
          selectedCard={selectedCard}
          amountNum={amountNum}
          maskCard={maskCard}
          resolveBrand={resolveBrand}
        />
      }
      footer={
        <>
          <span aria-hidden="true" />
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-busy={isSubmitting}
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding funds…
              </>
            ) : (
              <>
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Add Funds
              </>
            )}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Card selection */}
          <section className="space-y-3">
            <FieldLabel>Select card</FieldLabel>
            {cards.length === 0 ? (
              <div className="rounded-surface border border-dashed border-border bg-muted/20 px-4 py-7 text-center text-sm text-muted-foreground">
                No active cards found.
              </div>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
                {cards.map((c) => (
                  <CardOption
                    key={c.card_id}
                    card={c}
                    selected={selectedCardId === c.card_id}
                    onSelect={() => setSelectedCardId(c.card_id)}
                    maskCard={maskCard}
                    resolveBrand={resolveBrand}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Amount input */}
          <section className="space-y-3">
            <FieldLabel htmlFor="topup-amount">Deposit amount</FieldLabel>
            <div className="rounded-panel bg-muted/50 px-5 py-6 ring-1 ring-border/60">
              <label
                htmlFor="topup-amount"
                className="mx-auto flex w-fit items-baseline justify-center gap-1.5 cursor-text"
              >
                <span
                  className="text-2xl font-light leading-none text-foreground/60"
                  aria-hidden="true"
                >
                  $
                </span>
                <input
                  ref={amountInputRef}
                  id="topup-amount"
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(formatAmount(e.target.value))}
                  placeholder="0.00"
                  inputMode="decimal"
                  aria-invalid={amountInvalid}
                  size={Math.max(4, (amount || '0.00').length)}
                  className="min-w-[3ch] bg-transparent text-center text-4xl font-bold leading-none tabular-nums tracking-tight outline-none placeholder:text-muted-foreground/40 sm:text-5xl text-card-foreground"
                />
              </label>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {QUICK_AMOUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => applyQuickAmount(n)}
                    className="rounded-pill bg-card px-3.5 py-1.5 text-xs font-semibold text-card-foreground ring-1 ring-border transition-colors hover:bg-primary/5 hover:text-primary hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted"
                  >
                    ${n}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {error && <FormBanner variant="error" message={error} />}
        </div>
      )}
    </SplitModal>
  )
}
