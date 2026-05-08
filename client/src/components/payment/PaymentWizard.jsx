import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronLeft, CreditCard, Loader2, XCircle } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import FormBanner from '@/components/ui/FormBanner'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/context/NotificationContext'
import { listCards } from '@/services/cardsService'
import { lookupCardByNumber } from '@/services/cardsService'
import transactionTypesService from '@/services/transactionTypesService'
import transactionsService from '@/services/transactionsService'

// Transaction types that make sense for a user-initiated send
const SEND_TYPE_NAMES = new Set(['payment', 'refund'])

const AUTO_CLOSE_MS = 3500

function formatCardNumber(value) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}

function formatAmount(value) {
  // Allow digits and a single decimal point with up to 2 decimal places
  const cleaned = value.replace(/[^\d.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('')
  if (parts[1]?.length > 2) return parts[0] + '.' + parts[1].slice(0, 2)
  return cleaned
}

// ─── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`block h-1.5 rounded-full transition-all duration-300 ${
            i === current
              ? 'w-6 bg-primary'
              : i < current
              ? 'w-1.5 bg-primary/40'
              : 'w-1.5 bg-border'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Step 1: From card + type ──────────────────────────────────────────────────

function StepFrom({ state, onChange, cards, txTypes, onNext }) {
  const canProceed = state.fromCardId && state.txTypeId

  return (
    <div className="space-y-5">
      <StepDots current={0} total={3} />

      <div className="space-y-1.5">
        <Label htmlFor="from-card">From card</Label>
        <select
          id="from-card"
          value={state.fromCardId ?? ''}
          onChange={(e) => onChange('fromCardId', Number(e.target.value) || null)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select a card…</option>
          {cards.map((c) => (
            <option key={c.card_id} value={c.card_id}>
              {c.masked_card_number} — Balance: ${Number(c.balance).toFixed(2)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tx-type">Transaction type</Label>
        <select
          id="tx-type"
          value={state.txTypeId ?? ''}
          onChange={(e) => onChange('txTypeId', Number(e.target.value) || null)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select type…</option>
          {txTypes.map((t) => (
            <option key={t.transaction_type_id} value={t.transaction_type_id}>
              {t.name.charAt(0).toUpperCase() + t.name.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end pt-1">
        <Button onClick={onNext} disabled={!canProceed}>
          Continue
        </Button>
      </div>
    </div>
  )
}

// ─── Step 2: Recipient + amount + note ────────────────────────────────────────

function StepTo({ state, onChange, fromCard, onNext, onBack }) {
  const [lookupState, setLookupState] = useState(
    state.recipientInfo
      ? { status: 'found', info: state.recipientInfo }
      : { status: 'idle' }
  )
  const debounceRef = useRef(null)

  const rawDigits = state.recipientCardNumber.replace(/\D/g, '')
  const balance = fromCard ? Number(fromCard.balance) : null
  const amountNum = parseFloat(state.amount)
  const amountError =
    balance !== null && !isNaN(amountNum) && amountNum > balance
      ? `Exceeds available balance ($${balance.toFixed(2)})`
      : null

  function handleCardNumberChange(e) {
    const formatted = formatCardNumber(e.target.value)
    const digits = formatted.replace(/\D/g, '')
    onChange('recipientCardNumber', formatted)
    onChange('recipientInfo', null)

    clearTimeout(debounceRef.current)

    if (digits.length === 16) {
      setLookupState({ status: 'loading' })
      debounceRef.current = setTimeout(async () => {
        try {
          const info = await lookupCardByNumber(digits)
          setLookupState({ status: 'found', info })
          onChange('recipientInfo', info)
        } catch {
          setLookupState({ status: 'not_found' })
        }
      }, 500)
    } else {
      setLookupState({ status: 'idle' })
    }
  }

  const canProceed =
    lookupState.status === 'found' &&
    state.amount !== '' &&
    !isNaN(amountNum) &&
    amountNum > 0 &&
    !amountError

  return (
    <div className="space-y-5">
      <StepDots current={1} total={3} />

      {/* Recipient card */}
      <div className="space-y-1.5">
        <Label htmlFor="recipient">Recipient card number</Label>
        <div className="relative">
          <Input
            id="recipient"
            value={state.recipientCardNumber}
            onChange={handleCardNumberChange}
            placeholder="0000 0000 0000 0000"
            inputMode="numeric"
            maxLength={19}
            className={
              lookupState.status === 'not_found' ? 'border-destructive pr-9' : 'pr-9'
            }
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {lookupState.status === 'loading' && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {lookupState.status === 'found' && (
              <CheckCircle2 className="h-4 w-4 text-success" />
            )}
            {lookupState.status === 'not_found' && (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            {lookupState.status === 'idle' && rawDigits.length > 0 && (
              <CreditCard className="h-4 w-4" />
            )}
          </span>
        </div>

        {/* Owner info pill */}
        {lookupState.status === 'found' && lookupState.info && (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/25 px-3 py-2 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-semibold">{lookupState.info.owner_name}</span>
              {' — '}
              {lookupState.info.owner_email}
            </span>
          </div>
        )}
        {lookupState.status === 'not_found' && (
          <p className="text-xs text-destructive">No active card found with that number.</p>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="amount">Amount</Label>
          {balance !== null && (
            <span className="text-xs text-muted-foreground">
              Available: ${balance.toFixed(2)}
            </span>
          )}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <Input
            id="amount"
            value={state.amount}
            onChange={(e) => onChange('amount', formatAmount(e.target.value))}
            placeholder="0.00"
            inputMode="decimal"
            className={`pl-6 ${amountError ? 'border-destructive' : ''}`}
          />
        </div>
        {amountError && <p className="text-xs text-destructive">{amountError}</p>}
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label htmlFor="note">
          Note{' '}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="note"
          value={state.note}
          onChange={(e) => onChange('note', e.target.value.slice(0, 255))}
          placeholder="What's this payment for?"
          maxLength={255}
        />
      </div>

      <div className="flex justify-between pt-1">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Review
        </Button>
      </div>
    </div>
  )
}

// ─── Step 3: Review ────────────────────────────────────────────────────────────

function StepReview({ state, fromCard, txTypes, onSubmit, onBack, isSubmitting, error }) {
  const txType = txTypes.find((t) => t.transaction_type_id === state.txTypeId)

  return (
    <div className="space-y-5">
      <StepDots current={2} total={3} />

      <div className="rounded-2xl border border-border bg-muted/30 divide-y divide-border text-sm">
        <ReviewRow label="From" value={fromCard?.masked_card_number ?? '—'} />
        <ReviewRow
          label="To"
          value={
            <span>
              {state.recipientInfo?.masked_card_number ?? '—'}
              <span className="ml-2 text-muted-foreground">
                {state.recipientInfo?.owner_name}
              </span>
            </span>
          }
        />
        <ReviewRow label="Type" value={txType?.name ?? '—'} capitalize />
        <ReviewRow
          label="Amount"
          value={`$${Number(state.amount).toFixed(2)}`}
          bold
        />
        {state.note && <ReviewRow label="Note" value={state.note} />}
      </div>

      {error && <FormBanner variant="error" message={error} />}

      <div className="flex justify-between pt-1">
        <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending…
            </>
          ) : (
            'Confirm & Send'
          )}
        </Button>
      </div>
    </div>
  )
}

function ReviewRow({ label, value, bold, capitalize }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span
        className={`text-right ${bold ? 'font-semibold text-card-foreground' : ''} ${
          capitalize ? 'capitalize' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Step 4: Result ────────────────────────────────────────────────────────────

function StepResult({ amount, onClose }) {
  const [countdown, setCountdown] = useState(Math.round(AUTO_CLOSE_MS / 1000))

  useEffect(() => {
    const interval = setInterval(
      () => setCountdown((c) => Math.max(0, c - 1)),
      1000
    )
    const timeout = setTimeout(onClose, AUTO_CLOSE_MS)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [onClose])

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
        <CheckCircle2 className="h-9 w-9 text-success" strokeWidth={1.8} />
      </span>
      <div className="space-y-1">
        <p className="text-lg font-semibold text-card-foreground">Payment sent!</p>
        <p className="text-2xl font-bold text-card-foreground">
          ${Number(amount).toFixed(2)}
        </p>
        <p className="text-sm text-muted-foreground">
          Closing in {countdown}s…
        </p>
      </div>
      <Button variant="outline" onClick={onClose} className="mt-2">
        Done
      </Button>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

const INITIAL_FORM = {
  fromCardId: null,
  txTypeId: null,
  recipientCardNumber: '',
  recipientInfo: null,
  amount: '',
  note: '',
}

export default function PaymentWizard({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth()
  const { notify } = useNotifications()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL_FORM)
  const [cards, setCards] = useState([])
  const [txTypes, setTxTypes] = useState([])
  const [isLoadingRef, setIsLoadingRef] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [succeeded, setSucceeded] = useState(false)

  // Load reference data when wizard opens
  useEffect(() => {
    if (!isOpen || !user) return
    setIsLoadingRef(true)

    Promise.all([
      listCards({ user_id: user.id, limit: 100 }),
      transactionTypesService.list(),
    ])
      .then(([rawCards, rawTypes]) => {
        // Only show active, non-deleted cards
        setCards(rawCards.filter((c) => !c.deleted_at))
        // Filter to send-relevant types only
        setTxTypes(rawTypes.filter((t) => SEND_TYPE_NAMES.has(t.name)))
      })
      .catch(() => {})
      .finally(() => setIsLoadingRef(false))
  }, [isOpen, user])

  function resetAndClose() {
    setStep(0)
    setForm(INITIAL_FORM)
    setSubmitError('')
    setSucceeded(false)
    onClose()
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    setSubmitError('')
    setIsSubmitting(true)

    try {
      await transactionsService.create({
        sender_card_id: form.fromCardId,
        recipient_card_id: form.recipientInfo.card_id,
        transaction_type_id: form.txTypeId,
        amount: form.amount,
        note: form.note || null,
      })

      setSucceeded(true)
      setStep(3)

      // Sender toast
      notify({
        type: 'success',
        message: `$${Number(form.amount).toFixed(2)} sent successfully.`,
      })

      // Same-user recipient toast (different card of the same logged-in user)
      if (form.recipientInfo.user_id === user?.id) {
        notify({
          type: 'info',
          message: `+$${Number(form.amount).toFixed(2)} received on card ****${form.recipientInfo.last_four}.`,
          duration: 5000,
        })
      }

      onSuccess?.()
    } catch (err) {
      const msg =
        err?.message ||
        'Payment failed. Please check the details and try again.'
      setSubmitError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const fromCard = cards.find((c) => c.card_id === form.fromCardId) ?? null

  const STEP_TITLES = ['Send Payment', 'Recipient & Amount', 'Review', 'Success']

  return (
    <Modal
      isOpen={isOpen}
      onClose={succeeded ? resetAndClose : resetAndClose}
      title={STEP_TITLES[step]}
      size="default"
    >
      {isLoadingRef ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : step === 0 ? (
        <StepFrom
          state={form}
          onChange={handleChange}
          cards={cards}
          txTypes={txTypes}
          onNext={() => setStep(1)}
        />
      ) : step === 1 ? (
        <StepTo
          state={form}
          onChange={handleChange}
          fromCard={fromCard}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
        />
      ) : step === 2 ? (
        <StepReview
          state={form}
          fromCard={fromCard}
          txTypes={txTypes}
          onSubmit={handleSubmit}
          onBack={() => setStep(1)}
          isSubmitting={isSubmitting}
          error={submitError}
        />
      ) : (
        <StepResult amount={form.amount} onClose={resetAndClose} />
      )}
    </Modal>
  )
}
