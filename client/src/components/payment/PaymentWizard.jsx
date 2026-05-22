import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Loader2,
  Send,
  XCircle,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import FormBanner from '@/components/ui/FormBanner'
import UserAvatar from '@/components/ui/UserAvatar'
import RecipientPicker from '@/components/payment/RecipientPicker'
import { useAuth } from '@/hooks/useAuth'
import { useCardBrandResolver } from '@/hooks/useCardBrandResolver'
import { formatBrandLabel } from '@/utils/paymentCard.utils'
import CardBrandIcon from '@/components/ui/CardBrandIcon'
import { useNotifications } from '@/context/NotificationContext'
import { listCards, lookupCardByNumber } from '@/services/cardsService'
import transactionTypesService from '@/services/transactionTypesService'
import transactionsService from '@/services/transactionsService'
import { DATA_CHANGE_KINDS, emitDataChange } from '@/utils/dataEvents'

const SEND_TYPE_NAMES = new Set(['payment', 'refund'])
const AUTO_CLOSE_MS = 3500

function formatCardNumber(value) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}

function formatAmount(value) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('')
  if (parts[1]?.length > 2) return parts[0] + '.' + parts[1].slice(0, 2)
  return cleaned
}

// ─── Step progress bar ────────────────────────────────────────────────────────

const STEP_LABELS = ['From', 'To & Amount', 'Review']

function StepProgress({ current }) {
  return (
    <div className="flex items-start gap-0 mb-7">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full items-center">
            {/* Left connector */}
            <div
              className={`flex-1 h-px transition-colors duration-300 ${
                i === 0 ? 'invisible' : i <= current ? 'bg-primary' : 'bg-border'
              }`}
            />
            {/* Circle */}
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                i < current
                  ? 'bg-primary text-primary-foreground'
                  : i === current
                  ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                  : 'border-2 border-border bg-card text-muted-foreground'
              }`}
            >
              {i < current ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
            </div>
            {/* Right connector */}
            <div
              className={`flex-1 h-px transition-colors duration-300 ${
                i === STEP_LABELS.length - 1
                  ? 'invisible'
                  : i < current
                  ? 'bg-primary'
                  : 'bg-border'
              }`}
            />
          </div>
          <span
            className={`text-xs transition-colors duration-200 ${
              i === current ? 'font-semibold text-primary' : 'text-muted-foreground'
            }`}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Step 1: From card + transaction type ─────────────────────────────────────

function StepFrom({ state, onChange, cards, txTypes, onNext }) {
  const { maskCard, resolveBrand } = useCardBrandResolver()
  const canProceed = state.fromCardId && state.txTypeId

  return (
    <div className="space-y-6">
      <StepProgress current={0} />

      {/* Card selection */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-card-foreground">Pay from</p>
        {cards.length === 0 ? (
          <div className="rounded-surface border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            No active cards found.
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
            {cards.map((c) => {
              const selected = state.fromCardId === c.card_id
              return (
                <button
                  key={c.card_id}
                  type="button"
                  onClick={() => onChange('fromCardId', c.card_id)}
                  className={`group w-full rounded-input border p-4 text-left transition-all duration-200 ${
                    selected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/25'
                      : 'border-border bg-card hover:border-primary/30 hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-11 shrink-0 items-center justify-center overflow-hidden rounded-chip shadow-xs">
                        <CardBrandIcon
                          brand={resolveBrand(c.card_type_id)}
                          width={44}
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-card-foreground">
                          {maskCard(c)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="capitalize">
                            {formatBrandLabel(resolveBrand(c.card_type_id))}
                          </span>
                          {' · Balance: '}
                          <span className="font-medium text-card-foreground">
                            ${Number(c.balance).toFixed(2)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        selected
                          ? 'border-primary bg-primary'
                          : 'border-border'
                      }`}
                    >
                      {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Transaction type pills */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-card-foreground">Transaction type</p>
        <div className="grid grid-cols-2 gap-2">
          {txTypes.map((t) => {
            const selected = state.txTypeId === t.transaction_type_id
            return (
              <button
                key={t.transaction_type_id}
                type="button"
                onClick={() => onChange('txTypeId', t.transaction_type_id)}
                className={`rounded-input border px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                  selected
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-card text-card-foreground hover:border-primary/30 hover:bg-primary/5'
                }`}
              >
                {t.name.charAt(0).toUpperCase() + t.name.slice(1)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button onClick={onNext} disabled={!canProceed}>
          Continue
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Step 2: Recipient + amount + note ────────────────────────────────────────

function StepTo({ state, onChange, fromCard, onNext, onBack, currentUserId }) {
  const [lookupState, setLookupState] = useState(
    state.recipientInfo ? { status: 'found', info: state.recipientInfo } : { status: 'idle' }
  )
  const [recipientError, setRecipientError] = useState('')
  const debounceRef = useRef(null)

  const balance = fromCard ? Number(fromCard.balance) : null
  const amountNum = parseFloat(state.amount)
  const amountExceedsBalance =
    balance !== null && !isNaN(amountNum) && amountNum > balance

  function handleCardNumberChange(e) {
    const formatted = formatCardNumber(e.target.value)
    const digits = formatted.replace(/\D/g, '')
    onChange('recipientCardNumber', formatted)
    onChange('recipientInfo', null)
    setRecipientError('')
    clearTimeout(debounceRef.current)

    if (digits.length === 16) {
      setLookupState({ status: 'loading' })
      debounceRef.current = setTimeout(async () => {
        try {
          const info = await lookupCardByNumber(digits)
          if (info.user_id === currentUserId) {
            setLookupState({ status: 'idle' })
            setRecipientError("You can't send money to yourself.")
            return
          }
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

  function handleRecipientModeChange(mode) {
    onChange('recipientMode', mode)
    onChange('recipientInfo', null)
    onChange('recipientCardNumber', '')
    onChange('recipientEmailQuery', '')
    setLookupState({ status: 'idle' })
    setRecipientError('')
    clearTimeout(debounceRef.current)
  }

  function handleEmailQueryChange(value) {
    onChange('recipientEmailQuery', value)
    onChange('recipientInfo', null)
    setLookupState({ status: 'idle' })
    setRecipientError('')
  }

  function handleEmailRecipientSelect(info) {
    if (info.user_id === currentUserId) {
      setRecipientError("You can't send money to yourself.")
      return
    }
    onChange('recipientInfo', info)
    onChange('recipientCardNumber', info.masked_card_number)
    setLookupState({ status: 'found', info })
    setRecipientError('')
  }

  const canProceed =
    state.recipientInfo &&
    !recipientError &&
    state.amount !== '' &&
    !isNaN(amountNum) &&
    amountNum > 0 &&
    !amountExceedsBalance

  return (
    <div className="space-y-6">
      <StepProgress current={1} />

      {/* Recipient */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 rounded-surface border border-border bg-muted/20 p-1">
          <button
            type="button"
            onClick={() => handleRecipientModeChange('card')}
            className={`rounded-input px-3 py-2 text-sm font-semibold transition-colors ${
              state.recipientMode === 'card'
                ? 'bg-card text-card-foreground shadow-sm'
                : 'text-muted-foreground hover:text-card-foreground'
            }`}
          >
            By card number
          </button>
          <button
            type="button"
            onClick={() => handleRecipientModeChange('email')}
            className={`rounded-input px-3 py-2 text-sm font-semibold transition-colors ${
              state.recipientMode === 'email'
                ? 'bg-card text-card-foreground shadow-sm'
                : 'text-muted-foreground hover:text-card-foreground'
            }`}
          >
            By email
          </button>
        </div>

        {state.recipientMode === 'email' ? (
          <RecipientPicker
            query={state.recipientEmailQuery}
            onQueryChange={handleEmailQueryChange}
            selectedRecipient={state.recipientInfo}
            onSelect={handleEmailRecipientSelect}
            currentUserId={currentUserId}
          />
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-card-foreground">Recipient card number</p>
            <div className="relative">
              <Input
                value={state.recipientCardNumber}
                onChange={handleCardNumberChange}
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
                maxLength={19}
                className={`pr-10 font-mono ${
                  lookupState.status === 'not_found' ? 'border-destructive' : ''
                }`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                {lookupState.status === 'loading' && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {lookupState.status === 'found' && (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                )}
                {lookupState.status === 'not_found' && (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                {lookupState.status === 'idle' && (
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
            </div>

            {lookupState.status === 'found' && lookupState.info && (
              <div className="flex items-center gap-2.5 rounded-input border border-success/30 bg-success/8 px-3 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-card-foreground">
                    {lookupState.info.owner_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {lookupState.info.owner_email}
                  </p>
                </div>
              </div>
            )}
            {lookupState.status === 'not_found' && (
              <p className="text-xs text-destructive">No active card found with that number.</p>
            )}
          </div>
        )}
        {recipientError && <p className="text-xs text-destructive">{recipientError}</p>}
      </div>

      {/* Amount — large centered display */}
      <div className="flex flex-col items-center gap-1.5 rounded-panel border border-border bg-muted/20 py-6">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Amount
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-light text-muted-foreground">$</span>
          <input
            type="text"
            value={state.amount}
            onChange={(e) => onChange('amount', formatAmount(e.target.value))}
            placeholder="0.00"
            inputMode="decimal"
            className={`w-40 bg-transparent text-center text-5xl font-bold caret-transparent outline-none placeholder:text-muted-foreground/30 ${
              amountExceedsBalance ? 'text-destructive' : 'text-card-foreground'
            }`}
          />
        </div>
        {balance !== null && (
          <p
            className={`text-xs ${
              amountExceedsBalance ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {amountExceedsBalance
              ? `Exceeds available balance ($${balance.toFixed(2)})`
              : `Available: $${balance.toFixed(2)}`}
          </p>
        )}
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-card-foreground">
          Note{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
        <Input
          value={state.note}
          onChange={(e) => onChange('note', e.target.value.slice(0, 255))}
          placeholder="What's this payment for?"
          maxLength={255}
        />
      </div>

      <div className="flex justify-between pt-1">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Review
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Step 3: Review (receipt style) ───────────────────────────────────────────

function StepReview({ state, fromCard, txTypes, onSubmit, onBack, isSubmitting, error }) {
  const { maskCard, resolveBrand } = useCardBrandResolver()
  const txType = txTypes.find((t) => t.transaction_type_id === state.txTypeId)
  const recipientNameParts = state.recipientInfo?.owner_name?.split(' ') ?? []

  return (
    <div className="space-y-5">
      <StepProgress current={2} />

      {/* From → To visual */}
      <div className="flex items-center gap-3 rounded-panel border border-border bg-muted/20 p-4">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
          <span className="flex h-8 w-11 items-center justify-center overflow-hidden rounded-chip shadow-xs">
            <CardBrandIcon
              brand={fromCard ? resolveBrand(fromCard.card_type_id) : null}
              width={44}
            />
          </span>
          <p className="font-mono text-xs font-semibold text-card-foreground">
            {fromCard ? maskCard(fromCard) : '—'}
          </p>
          <p className="text-xs text-muted-foreground">You</p>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
            <ArrowRight className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-xs font-semibold text-primary">
            ${Number(state.amount).toFixed(2)}
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
          <span className="flex h-8 w-11 items-center justify-center overflow-hidden rounded-chip shadow-xs">
            <CardBrandIcon
              brand={state.recipientInfo?.brand ?? null}
              width={44}
            />
          </span>
          <p className="font-mono text-xs font-semibold text-card-foreground">
            {state.recipientInfo ? maskCard(state.recipientInfo) : '—'}
          </p>
          <p className="max-w-[90px] truncate text-xs text-muted-foreground">
            {state.recipientInfo?.owner_name}
          </p>
        </div>
      </div>

      {state.recipientInfo && (
        <div className="flex items-center gap-3 rounded-surface border border-primary/25 bg-primary/5 p-4">
          <UserAvatar
            user={{
              first_name: recipientNameParts[0],
              last_name: recipientNameParts.slice(1).join(' '),
              avatar_url: state.recipientInfo.avatar_url,
            }}
            className="h-12 w-12 text-sm"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-card-foreground">
              Confirm recipient: {state.recipientInfo.owner_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {state.recipientInfo.owner_email} · card ****{state.recipientInfo.last_four}
            </p>
          </div>
        </div>
      )}

      {/* Receipt rows */}
      <div className="divide-y divide-border rounded-surface border border-border bg-card text-sm">
        <ReceiptRow label="Type" value={txType?.name} capitalize />
        {state.note && <ReceiptRow label="Note" value={state.note} />}
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="font-medium text-card-foreground">Total</span>
          <span className="text-base font-bold text-card-foreground">
            ${Number(state.amount).toFixed(2)}
          </span>
        </div>
      </div>

      {error && <FormBanner variant="error" message={error} />}

      <div className="flex justify-between pt-1">
        <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Confirm & Send
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function ReceiptRow({ label, value, capitalize }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right text-card-foreground ${capitalize ? 'capitalize' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

// ─── Step 4: Success ──────────────────────────────────────────────────────────

function StepResult({ amount, recipientName, onClose }) {
  const [countdown, setCountdown] = useState(Math.round(AUTO_CLOSE_MS / 1000))

  useEffect(() => {
    const interval = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000)
    const timeout = setTimeout(onClose, AUTO_CLOSE_MS)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [onClose])

  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      {/* Pulsing ring + icon */}
      <span className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-success/20 opacity-75" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-success/15">
          <CheckCircle2 className="h-10 w-10 text-success" strokeWidth={1.6} />
        </span>
      </span>

      <div className="space-y-1">
        <p className="text-lg font-semibold text-card-foreground">Payment sent!</p>
        <p className="text-4xl font-bold tracking-tight text-card-foreground">
          ${Number(amount).toFixed(2)}
        </p>
        {recipientName && (
          <p className="text-sm text-muted-foreground">to {recipientName}</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Closing in {countdown}s…</p>

      <Button variant="outline" onClick={onClose} className="mt-1 w-full">
        Done
      </Button>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

const INITIAL_FORM = {
  fromCardId: null,
  txTypeId: null,
  recipientMode: 'card',
  recipientCardNumber: '',
  recipientEmailQuery: '',
  recipientInfo: null,
  amount: '',
  note: '',
}

const STEP_TITLES = ['Send Payment', 'Send Payment', 'Send Payment', 'Payment Sent']

export default function PaymentWizard({ isOpen, onClose, onSuccess, initialCardId = null }) {
  const { user } = useAuth()
  const { notify } = useNotifications()
  const currentUserId = user?.user_id ?? user?.id

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL_FORM)
  const [cards, setCards] = useState([])
  const [txTypes, setTxTypes] = useState([])
  const [isLoadingRef, setIsLoadingRef] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setStep(initialCardId ? 1 : 0)
    setForm({ ...INITIAL_FORM, fromCardId: initialCardId ?? null })
    setSubmitError('')
  }, [isOpen, initialCardId])

  useEffect(() => {
    if (!isOpen || !user) return
    setIsLoadingRef(true)

    Promise.all([listCards({ user_id: user.id, limit: 100 }), transactionTypesService.list()])
      .then(([rawCards, rawTypes]) => {
        setCards(rawCards.filter((c) => !c.deleted_at))
        const sendableTypes = rawTypes.filter((t) => SEND_TYPE_NAMES.has(t.name))
        setTxTypes(sendableTypes)
        const defaultType =
          sendableTypes.find((t) => t.name === 'payment') ?? sendableTypes[0] ?? null
        if (defaultType) {
          setForm((prev) =>
            prev.txTypeId ? prev : { ...prev, txTypeId: defaultType.transaction_type_id }
          )
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingRef(false))
  }, [isOpen, user])

  function resetAndClose() {
    setStep(0)
    setForm(INITIAL_FORM)
    setSubmitError('')
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

      setStep(3)

      notify({
        type: 'success',
        message: `$${Number(form.amount).toFixed(2)} sent to ${form.recipientInfo.owner_name}.`,
      })

      if (form.recipientInfo.user_id === user?.id) {
        notify({
          type: 'info',
          message: `+$${Number(form.amount).toFixed(2)} received on card ****${form.recipientInfo.last_four}.`,
          duration: 5000,
        })
      }

      emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
      onSuccess?.()
    } catch (err) {
      setSubmitError(err?.message || 'Payment failed. Please check the details and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const fromCard = cards.find((c) => c.card_id === form.fromCardId) ?? null

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title={STEP_TITLES[step]} size="lg">
      {isLoadingRef ? (
        <div className="flex items-center justify-center py-16">
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
          currentUserId={currentUserId}
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
        <StepResult
          amount={form.amount}
          recipientName={form.recipientInfo?.owner_name}
          onClose={resetAndClose}
        />
      )}
    </Modal>
  )
}
