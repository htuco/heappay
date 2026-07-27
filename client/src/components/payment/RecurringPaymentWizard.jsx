import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Info,
  Loader2,
  XCircle,
} from 'lucide-react'

import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import FormBanner from '@/components/ui/FormBanner'
import UserAvatar from '@/components/ui/UserAvatar'
import RecipientPicker from '@/components/payment/RecipientPicker'
import {
  CardOption,
  ReceiptRow,
  SegmentedControl,
  StepProgress,
  WizardFooter,
} from '@/components/payment/wizardPrimitives'
import {
  AmountInput,
  DayOfMonthPicker,
  MonthPicker,
} from '@/components/payment/recurringFormControls'
import {
  formatMonthsPhrase,
  formatRawCardNumber,
  ordinal,
  parseDueDate,
} from '@/utils/recurringPayments.utils'
import { useCardBrandResolver } from '@/hooks/useCardBrandResolver'
import { lookupCardByNumber } from '@/services/cardsService'
import { formatMoney } from '@/utils/amount'

const STEP_LABELS = ['Pay from', 'Recipient', 'Amount', 'Schedule', 'Review']

const STEP_HEADINGS = [
  { title: 'Pay from', subtitle: 'Select the card to pay from.' },
  { title: 'Recipient', subtitle: 'Who are you paying?' },
  { title: 'Amount', subtitle: 'How much should go out each time?' },
  { title: 'Schedule', subtitle: 'When should this repeat?' },
  { title: 'Review & confirm', subtitle: 'You can edit any detail before creating.' },
]

const QUICK_AMOUNTS = [10, 25, 50, 100]

const INITIAL_FORM = {
  sender_card_id: null,
  recipientMode: 'email',
  recipientCardNumber: '',
  recipientEmailQuery: '',
  recipientInfo: null,
  amount: '',
  day_of_month: '',
  months: [],
  note: '',
}

function formatDueDate(dateStr) {
  // parseDueDate handles the YYYY-MM-DD → local-midnight conversion; parsing it
  // directly would read a day early west of UTC.
  const date = parseDueDate(dateStr)
  if (!date) return null
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Step 1: Pay from ─────────────────────────────────────────────────────────

function StepFrom({ selectedCardId, set, cards, maskCard, resolveBrand, onNext }) {
  return (
    <div className="space-y-4">
      {cards.length === 0 ? (
        <div className="rounded-surface border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No active cards found. Add a card before setting up a recurring payment.
        </div>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
          {cards.map((card) => (
            <CardOption
              key={card.card_id}
              card={card}
              selected={selectedCardId === card.card_id}
              onSelect={() => set('sender_card_id', card.card_id)}
              maskCard={maskCard}
              resolveBrand={resolveBrand}
              badge={card.is_main ? 'Default' : null}
            />
          ))}
        </div>
      )}

      <WizardFooter>
        <span />
        <Button onClick={onNext} disabled={!selectedCardId}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </WizardFooter>
    </div>
  )
}

// ─── Step 2: Recipient ────────────────────────────────────────────────────────

function StepRecipient({
  form,
  set,
  currentUserId,
  lookupState,
  setLookupState,
  recipientError,
  setRecipientError,
  onNext,
  onBack,
}) {
  const debounceRef = useRef(null)

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  function handleModeChange(mode) {
    set('recipientMode', mode)
    set('recipientInfo', null)
    set('recipientCardNumber', '')
    set('recipientEmailQuery', '')
    setLookupState({ status: 'idle' })
    setRecipientError('')
    clearTimeout(debounceRef.current)
  }

  function handleCardNumberChange(e) {
    const formatted = formatRawCardNumber(e.target.value)
    const digits = formatted.replace(/\D/g, '')
    set('recipientCardNumber', formatted)
    set('recipientInfo', null)
    setRecipientError('')
    clearTimeout(debounceRef.current)

    if (digits.length !== 16) {
      setLookupState({ status: 'idle' })
      return
    }

    setLookupState({ status: 'loading' })
    debounceRef.current = setTimeout(async () => {
      try {
        const info = await lookupCardByNumber(digits)
        if (info.user_id === currentUserId) {
          setLookupState({ status: 'idle' })
          setRecipientError("You can't set up a recurring payment to yourself.")
          return
        }
        setLookupState({ status: 'found', info })
        set('recipientInfo', info)
      } catch {
        setLookupState({ status: 'not_found' })
      }
    }, 500)
  }

  function handleEmailSelect(info) {
    if (info.user_id === currentUserId) {
      setRecipientError("You can't set up a recurring payment to yourself.")
      return
    }
    set('recipientInfo', info)
    set('recipientEmailQuery', info.owner_email ?? '')
    setLookupState({ status: 'found', info })
    setRecipientError('')
  }

  return (
    <div className="space-y-4">
      <SegmentedControl
        options={[
          { value: 'email', label: 'By email' },
          { value: 'card', label: 'By card number' },
        ]}
        value={form.recipientMode}
        onChange={handleModeChange}
        ariaLabel="How to find the recipient"
      />

      {form.recipientMode === 'email' ? (
        <RecipientPicker
          query={form.recipientEmailQuery}
          onQueryChange={(v) => {
            set('recipientEmailQuery', v)
            set('recipientInfo', null)
          }}
          selectedRecipient={form.recipientInfo}
          onSelect={handleEmailSelect}
          currentUserId={currentUserId}
        />
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Input
              value={form.recipientCardNumber}
              onChange={handleCardNumberChange}
              placeholder="0000 0000 0000 0000"
              inputMode="numeric"
              maxLength={19}
              aria-invalid={lookupState.status === 'not_found'}
              className={`pr-10 font-mono tracking-wide ${
                lookupState.status === 'not_found' ? 'border-destructive' : ''
              }`}
            />
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            >
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
            <div className="flex items-center gap-3 rounded-surface bg-success/10 px-4 py-3 ring-1 ring-success/30">
              <UserAvatar
                user={{
                  full_name: lookupState.info.owner_name,
                  avatar_url: lookupState.info.avatar_url,
                }}
                className="h-9 w-9 text-xs ring-1 ring-success/30"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-card-foreground">
                  {lookupState.info.owner_name}
                </p>
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {lookupState.info.owner_email}
                </p>
              </div>
            </div>
          )}
          {lookupState.status === 'not_found' && (
            <p className="text-xs font-medium text-destructive">
              No active card found with that number.
            </p>
          )}
        </div>
      )}

      {recipientError && <p className="text-xs text-destructive">{recipientError}</p>}

      <WizardFooter>
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!form.recipientInfo || Boolean(recipientError)}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </WizardFooter>
    </div>
  )
}

// ─── Step 3: Amount ───────────────────────────────────────────────────────────

function StepAmount({ form, set, onNext, onBack }) {
  return (
    <div className="space-y-4">
      <div className="rounded-panel bg-muted/50 px-4 py-6 ring-1 ring-border/60">
        <label className="mx-auto flex w-fit cursor-text items-baseline justify-center gap-1.5">
          <span className="text-xl font-light leading-none text-foreground/60" aria-hidden="true">
            $
          </span>
          <AmountInput value={form.amount} onChange={(v) => set('amount', v)} />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            USD
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => set('amount', amount.toFixed(2))}
            className="rounded-chip bg-muted px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            ${amount}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="recurring-note"
          className="text-xs font-semibold uppercase tracking-wider text-foreground/80"
        >
          Note <span className="font-normal normal-case text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="recurring-note"
          placeholder="e.g. Monthly rent, Spotify subscription…"
          value={form.note}
          onChange={(e) => set('note', e.target.value)}
          maxLength={255}
        />
      </div>

      <WizardFooter>
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!form.amount || Number(form.amount) <= 0}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </WizardFooter>
    </div>
  )
}

// ─── Step 4: Schedule ─────────────────────────────────────────────────────────

// No frequency control here: monthly is the only cadence the API models
// (day_of_month + months), so a single-option field was dead UI. The summary
// panel at the bottom states the cadence in words instead.
function StepSchedule({ form, set, onNext, onBack }) {
  return (
    <div className="space-y-4">
      <DayOfMonthPicker
        value={form.day_of_month}
        onChange={(v) => set('day_of_month', v)}
      />

      <MonthPicker value={form.months} onChange={(v) => set('months', v)} />

      {/* The plain-language restatement of day + months — the one thing the user
          should be able to read back before continuing. */}
      {form.day_of_month && (
        <div className="flex items-center gap-3 rounded-surface border border-primary/25 bg-primary/8 px-4 py-3.5">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-input bg-primary/15 text-primary"
            aria-hidden
          >
            <CalendarClock className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-bold leading-snug tracking-tight text-card-foreground sm:text-lg">
              Every {form.day_of_month}
              {ordinal(Number(form.day_of_month))} of {formatMonthsPhrase(form.months)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {form.amount
                ? `${formatMoney(form.amount)} leaves your card on that day.`
                : 'The payment leaves your card on that day.'}
            </p>
          </div>
        </div>
      )}

      <WizardFooter>
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!form.day_of_month}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </WizardFooter>
    </div>
  )
}

// ─── Step 5: Review ───────────────────────────────────────────────────────────

function StepReview({ form, fromCard, maskCard, onSubmit, onBack, isSubmitting, error }) {
  const recipientNameParts = form.recipientInfo?.owner_name?.split(' ') ?? []
  const schedule = form.day_of_month
    ? `Every ${form.day_of_month}${ordinal(Number(form.day_of_month))} of ${formatMonthsPhrase(form.months)}`
    : null

  return (
    <div className="space-y-4">
      {/* Recipient confirmation, mirroring the send wizard's review step. */}
      {form.recipientInfo && (
        <div className="flex items-center gap-4 rounded-surface bg-primary/8 p-4 ring-1 ring-primary/25">
          <UserAvatar
            user={{
              first_name: recipientNameParts[0],
              last_name: recipientNameParts.slice(1).join(' '),
              avatar_url: form.recipientInfo.avatar_url,
            }}
            className="h-12 w-12 text-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Confirm recipient
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-card-foreground">
              {form.recipientInfo.owner_name}
            </p>
            <p className="truncate text-xs font-medium text-muted-foreground">
              {form.recipientInfo.owner_email}
              <span aria-hidden="true"> · </span>
              card ****{form.recipientInfo.last_four}
            </p>
          </div>
        </div>
      )}

      <dl className="overflow-hidden rounded-surface bg-card text-sm ring-1 ring-border">
        <ReceiptRow label="From" value={fromCard ? maskCard(fromCard) : null} mono />
        <ReceiptRow label="Schedule" value={schedule} />
        {form.note && <ReceiptRow label="Note" value={form.note} />}
        <div className="flex items-center justify-between gap-4 bg-muted/40 px-4 py-4">
          <dt className="text-sm font-bold text-card-foreground">
            Each payment
            <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
              Repeats until you cancel
            </span>
          </dt>
          <dd className="tabular-nums text-xl font-bold tracking-tight text-card-foreground">
            {formatMoney(form.amount)}
          </dd>
        </div>
      </dl>

      <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Nothing is charged now — the first payment goes out on the next scheduled day.
        </span>
      </p>

      {error && <FormBanner variant="error" message={error} />}

      <WizardFooter>
        <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting} aria-busy={isSubmitting} size="lg">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <CalendarClock className="mr-2 h-4 w-4" />
              Create recurring payment
            </>
          )}
        </Button>
      </WizardFooter>
    </div>
  )
}

// ─── Success ──────────────────────────────────────────────────────────────────

function StepResult({ created, form, onClose }) {
  const firstPayment = formatDueDate(created?.next_due_at)

  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <span className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-success/20 opacity-75" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-success/15 ring-8 ring-success/5">
          <CheckCircle2 className="h-10 w-10 text-success" strokeWidth={1.8} />
        </span>
      </span>

      <div className="space-y-1.5">
        <p className="text-base font-semibold text-card-foreground">
          Recurring payment created!
        </p>
        <p className="text-sm text-muted-foreground">
          Your payment will be automatically sent on the scheduled date.
        </p>
      </div>

      <dl className="w-full overflow-hidden rounded-surface border border-border bg-card text-left">
        <ReceiptRow label="To" value={form.recipientInfo?.owner_name} />
        <ReceiptRow label="Amount" value={formatMoney(form.amount)} />
        <ReceiptRow
          label="Schedule"
          value={
            form.day_of_month
              ? `Every ${form.day_of_month}${ordinal(Number(form.day_of_month))} of ${formatMonthsPhrase(form.months)}`
              : null
          }
        />
        {firstPayment && <ReceiptRow label="First payment" value={firstPayment} />}
      </dl>

      <Button variant="outline" onClick={onClose} className="w-full">
        Done
      </Button>
    </div>
  )
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

/**
 * Stepped create flow for a recurring payment: Pay from → Recipient → Amount →
 * Schedule → Review, then a success screen. Mirrors `PaymentWizard`'s step
 * scaffolding (shared via `wizardPrimitives`) so the two flows read the same.
 *
 * Editing an existing rule stays on the simpler `RuleForm` dialog — the API only
 * lets amount / day / months / note change, so the card and recipient steps
 * would be dead weight there.
 *
 * Callers mount this only while open (see `RecurringPaymentsPage`), so a
 * cancelled run can't leak into the next one and no reset effect is needed.
 */
export default function RecurringPaymentWizard({
  isOpen,
  onClose,
  cards,
  currentUserId,
  onSubmit,
  isSubmitting,
  error,
  clearError,
}) {
  const { maskCard, resolveBrand } = useCardBrandResolver()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL_FORM)
  const [lookupState, setLookupState] = useState({ status: 'idle' })
  const [recipientError, setRecipientError] = useState('')
  const [created, setCreated] = useState(null)

  const activeCards = (cards ?? []).filter((c) => !c.deleted_at)

  // The default card is the *derived* selection until the user picks another —
  // cheaper than syncing it into state via an effect, and it self-corrects if
  // the card list arrives after the modal opens.
  const preferredCardId =
    (activeCards.find((c) => c.is_main) ?? activeCards[0])?.card_id ?? null
  const selectedCardId = form.sender_card_id ?? preferredCardId

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function goTo(next) {
    clearError?.()
    setStep(next)
  }

  async function handleSubmit() {
    const result = await onSubmit({
      sender_card_id: selectedCardId,
      recipient_card_id: form.recipientInfo.card_id,
      amount: form.amount,
      day_of_month: Number(form.day_of_month),
      months: form.months.length > 0 ? form.months : null,
      note: form.note || null,
    })
    // Falsy means the write failed — stay on Review so the banner shows and the
    // user can retry without re-entering anything.
    if (result) setCreated(result)
  }

  const isDone = Boolean(created)
  const heading = isDone
    ? { title: 'Recurring payment created', subtitle: null }
    : STEP_HEADINGS[step]
  const fromCard = activeCards.find((c) => c.card_id === selectedCardId) ?? null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={heading.title}
      subtitle={heading.subtitle}
      size="lg"
    >
      <div className="space-y-5">
        {!isDone && (
          <div className="pb-1">
            <StepProgress labels={STEP_LABELS} current={step} />
          </div>
        )}

        {isDone ? (
          <StepResult created={created} form={form} onClose={onClose} />
        ) : step === 0 ? (
          <StepFrom
            selectedCardId={selectedCardId}
            set={set}
            cards={activeCards}
            maskCard={maskCard}
            resolveBrand={resolveBrand}
            onNext={() => goTo(1)}
          />
        ) : step === 1 ? (
          <StepRecipient
            form={form}
            set={set}
            currentUserId={currentUserId}
            lookupState={lookupState}
            setLookupState={setLookupState}
            recipientError={recipientError}
            setRecipientError={setRecipientError}
            onNext={() => goTo(2)}
            onBack={() => goTo(0)}
          />
        ) : step === 2 ? (
          <StepAmount form={form} set={set} onNext={() => goTo(3)} onBack={() => goTo(1)} />
        ) : step === 3 ? (
          <StepSchedule form={form} set={set} onNext={() => goTo(4)} onBack={() => goTo(2)} />
        ) : (
          <StepReview
            form={form}
            fromCard={fromCard}
            maskCard={maskCard}
            onSubmit={handleSubmit}
            onBack={() => goTo(3)}
            isSubmitting={isSubmitting}
            error={error}
          />
        )}
      </div>
    </Modal>
  )
}
