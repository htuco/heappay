import { Fragment, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Info,
  Loader2,
  Send,
  X,
  XCircle,
} from 'lucide-react'
import { Modal, ModalTitle } from '@/components/ui/modal'
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
import { CATEGORIES } from '@/context/notifications/categories'
import { listCards, lookupCardByNumber } from '@/services/cardsService'
import transactionTypesService from '@/services/transactionTypesService'
import transactionsService from '@/services/transactionsService'
import { DATA_CHANGE_KINDS, emitDataChange } from '@/utils/dataEvents'
import { normalizeAmountForSubmit, sanitizeAmountInput } from '@/utils/amount'
import { createIdempotencyKey } from '@/utils/idempotency'
import PaymentApprovalModal from '@/components/payment/PaymentApprovalModal'

const SEND_TYPE_NAMES = new Set(['payment', 'fine'])
const AUTO_CLOSE_MS = 1200
const QUICK_AMOUNTS = [10, 25, 50]

function formatCardNumber(value) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}

function formatAmount(value) {
  return sanitizeAmountInput(value)
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

// ─── Shared bits ──────────────────────────────────────────────────────────────

const STEP_LABELS = ['From', 'To & Amount', 'Review']

function StepProgress({ current }) {
  return (
    <ol
      className="mx-auto flex w-full max-w-sm items-center"
      aria-label="Progress"
    >
      {STEP_LABELS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <Fragment key={label}>
            <li className="flex shrink-0 items-center gap-2">
              <div
                aria-current={active ? 'step' : undefined}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors duration-200 ${
                  done
                    ? 'bg-primary text-primary-foreground'
                    : active
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                    : 'bg-muted text-foreground/60 ring-1 ring-border'
                }`}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3.5} /> : i + 1}
              </div>
              <span
                className={`text-xs font-semibold transition-colors duration-200 ${
                  active
                    ? 'text-card-foreground'
                    : done
                    ? 'hidden text-card-foreground/80 sm:inline'
                    : 'hidden text-muted-foreground sm:inline'
                }`}
              >
                {label}
              </span>
            </li>
            {i < STEP_LABELS.length - 1 && (
              <div
                aria-hidden="true"
                className={`mx-3 h-0.5 min-w-6 flex-1 rounded-full transition-colors duration-300 ${
                  i < current ? 'bg-primary/60' : 'bg-border'
                }`}
              />
            )}
          </Fragment>
        )
      })}
    </ol>
  )
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

function SegmentedControl({ options, value, onChange, ariaLabel }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex w-full rounded-input bg-muted p-1 ring-1 ring-border/60"
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`min-h-11 flex-1 rounded-chip px-3 py-2 text-sm font-semibold transition-all duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:min-h-0 ${
              active
                ? 'bg-card text-card-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-card-foreground'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Left context panel ──────────────────────────────────────────────────────

function ContextLabel({ children }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  )
}

function ContextCardPreview({ card, maskCard, resolveBrand, label }) {
  if (!card) {
    return (
      <div className="rounded-surface border border-dashed border-border bg-card/40 px-4 py-5 text-center text-xs text-muted-foreground">
        {label ?? 'No card selected yet.'}
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
            Available
          </span>
          <span className="tabular-nums text-sm font-bold text-card-foreground">
            {formatMoney(card.balance)}
          </span>
        </div>
      )}
    </div>
  )
}

function LeftPanel({
  step,
  form,
  fromCard,
  txTypeName,
  maskCard,
  resolveBrand,
}) {
  const amountNum = parseFloat(form.amount)
  const hasAmount = !isNaN(amountNum) && amountNum > 0
  const recipient = form.recipientInfo
  const recipientNameParts = recipient?.owner_name?.split(' ') ?? []

  return (
    <aside className="hidden flex-col gap-5 bg-muted/40 p-6 md:flex">
      <p className="text-xs font-bold uppercase tracking-widest text-foreground/70">
        Send Payment
      </p>

      {step === 0 && (
        <div className="flex flex-1 flex-col gap-4">
          <ContextLabel>Selected source</ContextLabel>
          <ContextCardPreview
            card={fromCard}
            maskCard={maskCard}
            resolveBrand={resolveBrand}
            label="Choose a card on the right to see it here."
          />
          <div className="mt-auto rounded-surface bg-card/60 p-4 ring-1 ring-border/60">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Pick the card you want to pay from. Its available balance becomes
              the spending limit for this transfer.
            </p>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-1 flex-col gap-4">
          <div className="space-y-2">
            <ContextLabel>From</ContextLabel>
            <ContextCardPreview
              card={fromCard}
              maskCard={maskCard}
              resolveBrand={resolveBrand}
            />
          </div>

          <div className="space-y-2">
            <ContextLabel>To</ContextLabel>
            {recipient ? (
              <div className="flex items-center gap-3 rounded-surface bg-card p-4 ring-1 ring-border shadow-sm">
                <UserAvatar
                  user={{
                    first_name: recipientNameParts[0],
                    last_name: recipientNameParts.slice(1).join(' '),
                    avatar_url: recipient.avatar_url,
                  }}
                  className="h-10 w-10 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-card-foreground">
                    {recipient.owner_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {form.recipientMode === 'email'
                      ? recipient.owner_email
                      : `card ****${recipient.last_four}`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-surface border border-dashed border-border bg-card/40 px-4 py-5 text-center text-xs text-muted-foreground">
                {form.recipientMode === 'email'
                  ? 'Enter an email to look up the recipient.'
                  : 'Enter a card number to look up the recipient.'}
              </div>
            )}
          </div>

          <div className="mt-auto rounded-surface bg-card p-4 ring-1 ring-border shadow-sm">
            <ContextLabel>Amount</ContextLabel>
            <p
              className={`mt-2 tabular-nums text-2xl font-bold tracking-tight ${
                hasAmount ? 'text-card-foreground' : 'text-muted-foreground/60'
              }`}
            >
              {hasAmount ? formatMoney(amountNum) : '$0.00'}
            </p>
            {fromCard && (
              <p className="mt-1 text-xs text-muted-foreground">
                of{' '}
                <span className="font-semibold text-foreground/80">
                  {formatMoney(fromCard.balance)}
                </span>{' '}
                available
              </p>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-1 flex-col gap-4">
          <ContextLabel>You're sending</ContextLabel>
          <div className="rounded-surface bg-card p-5 ring-1 ring-border shadow-sm">
            <p className="tabular-nums text-3xl font-bold tracking-tight text-card-foreground">
              {formatMoney(form.amount)}
            </p>
            <p className="mt-1 text-xs font-medium capitalize text-muted-foreground">
              {txTypeName ?? 'Payment'}
            </p>
          </div>

          <div className="space-y-2">
            <ContextLabel>From</ContextLabel>
            <ContextCardPreview
              card={fromCard}
              maskCard={maskCard}
              resolveBrand={resolveBrand}
            />
          </div>

          {recipient && (
            <div className="space-y-2">
              <ContextLabel>To</ContextLabel>
              <div className="flex items-center gap-3 rounded-surface bg-card p-4 ring-1 ring-border shadow-sm">
                <UserAvatar
                  user={{
                    first_name: recipientNameParts[0],
                    last_name: recipientNameParts.slice(1).join(' '),
                    avatar_url: recipient.avatar_url,
                  }}
                  className="h-10 w-10 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-card-foreground">
                    {recipient.owner_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {recipient.owner_email}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

// ─── Step 1: From card ────────────────────────────────────────────────────────

function StepFrom({ state, onChange, cards, txTypes, onNext }) {
  const { maskCard, resolveBrand } = useCardBrandResolver()
  const canProceed = state.fromCardId && state.txTypeId

  const typeOptions = txTypes.map((t) => ({
    value: t.transaction_type_id,
    label: t.name.charAt(0).toUpperCase() + t.name.slice(1),
  }))

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <FieldLabel>Pay from</FieldLabel>
        {cards.length === 0 ? (
          <div className="rounded-surface border border-dashed border-border bg-muted/20 px-4 py-7 text-center text-sm text-muted-foreground">
            No active cards found.
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
            {cards.map((c) => (
              <CardOption
                key={c.card_id}
                card={c}
                selected={state.fromCardId === c.card_id}
                onSelect={() => onChange('fromCardId', c.card_id)}
                maskCard={maskCard}
                resolveBrand={resolveBrand}
              />
            ))}
          </div>
        )}
      </section>

      {typeOptions.length > 1 && (
        <section className="space-y-3">
          <FieldLabel>Transaction type</FieldLabel>
          <SegmentedControl
            options={typeOptions}
            value={state.txTypeId}
            onChange={(v) => onChange('txTypeId', v)}
            ariaLabel="Transaction type"
          />
        </section>
      )}

      <WizardFooter>
        <span aria-hidden="true" />
        <Button onClick={onNext} disabled={!canProceed} size="lg">
          Continue
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </WizardFooter>
    </div>
  )
}

// ─── Step 2: Recipient + amount + note ────────────────────────────────────────

function StepTo({ state, onChange, fromCard, onNext, onBack, currentUserId }) {
  const [lookupState, setLookupState] = useState(
    state.recipientInfo
      ? { status: 'found', info: state.recipientInfo }
      : { status: 'idle' }
  )
  const [recipientError, setRecipientError] = useState('')
  const debounceRef = useRef(null)
  const amountInputRef = useRef(null)

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

  function applyQuickAmount(n) {
    onChange('amount', n.toFixed(2))
    amountInputRef.current?.focus()
  }

  function handleAmountBlur() {
    const normalized = normalizeAmountForSubmit(state.amount)
    if (normalized) onChange('amount', normalized)
  }

  const canProceed =
    state.recipientInfo &&
    !recipientError &&
    state.amount !== '' &&
    !isNaN(amountNum) &&
    amountNum > 0 &&
    !amountExceedsBalance

  const amountInvalid =
    state.amount !== '' && (isNaN(amountNum) || amountExceedsBalance)

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <FieldLabel>Recipient method</FieldLabel>
        <SegmentedControl
          options={[
            { value: 'email', label: 'By email' },
            { value: 'card', label: 'By card number' },
          ]}
          value={state.recipientMode}
          onChange={handleRecipientModeChange}
          ariaLabel="Recipient method"
        />

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
            <FieldLabel htmlFor="recipient-card-number">
              Recipient card number
            </FieldLabel>
            <div className="relative">
              <Input
                id="recipient-card-number"
                value={state.recipientCardNumber}
                onChange={handleCardNumberChange}
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
                maxLength={19}
                aria-invalid={lookupState.status === 'not_found'}
                aria-describedby={
                  lookupState.status === 'not_found'
                    ? 'recipient-card-error'
                    : undefined
                }
                className={`pr-10 font-mono tracking-wide ${
                  lookupState.status === 'not_found' ? 'border-destructive' : ''
                }`}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
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
              <p
                id="recipient-card-error"
                className="text-xs font-medium text-destructive"
              >
                No active card found with that number.
              </p>
            )}
          </div>
        )}
        {recipientError && (
          <p className="text-xs text-destructive">{recipientError}</p>
        )}
      </section>

      {/* Amount — focal */}
      <section className="space-y-3">
        <FieldLabel htmlFor="payment-amount">Amount</FieldLabel>
        <div
          className={`rounded-panel bg-muted/50 px-5 py-6 transition-colors ${
            amountExceedsBalance
              ? 'ring-2 ring-destructive/40'
              : 'ring-1 ring-border/60'
          }`}
        >
          <label
            htmlFor="payment-amount"
            className="mx-auto flex w-fit items-baseline justify-center gap-1.5 cursor-text"
          >
            <span
              className={`text-2xl font-light leading-none ${
                amountExceedsBalance
                  ? 'text-destructive/80'
                  : 'text-foreground/60'
              }`}
              aria-hidden="true"
            >
              $
            </span>
            <input
              id="payment-amount"
              ref={amountInputRef}
              type="text"
              value={state.amount}
              onChange={(e) => onChange('amount', formatAmount(e.target.value))}
              onBlur={handleAmountBlur}
              placeholder="0.00"
              inputMode="decimal"
              aria-invalid={amountInvalid}
              aria-describedby="payment-amount-help"
              size={Math.max(4, (state.amount || '0.00').length)}
              className={`min-w-[3ch] bg-transparent text-center text-4xl font-bold leading-none tabular-nums tracking-tight outline-none placeholder:text-muted-foreground/40 sm:text-5xl ${
                amountExceedsBalance ? 'text-destructive' : 'text-card-foreground'
              }`}
            />
          </label>
          {balance !== null && (
            <p
              id="payment-amount-help"
              className={`mt-2 text-center text-xs font-medium tabular-nums ${
                amountExceedsBalance ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {amountExceedsBalance ? (
                <>
                  Exceeds available balance (
                  <span className="font-semibold">{formatMoney(balance)}</span>)
                </>
              ) : (
                <>
                  Available:{' '}
                  <span className="font-semibold text-foreground/80">
                    {formatMoney(balance)}
                  </span>
                </>
              )}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {QUICK_AMOUNTS.map((n) => {
              const disabled = balance !== null && n > balance
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => applyQuickAmount(n)}
                  disabled={disabled}
                  className="min-h-11 rounded-pill bg-card px-3.5 py-1.5 text-xs font-semibold text-card-foreground ring-1 ring-border transition-colors touch-manipulation hover:bg-primary/5 hover:text-primary hover:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-card-foreground disabled:hover:ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted md:min-h-0"
                >
                  ${n}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <FieldLabel htmlFor="payment-note" hint="Optional">
          Note
        </FieldLabel>
        <Input
          id="payment-note"
          value={state.note}
          onChange={(e) => onChange('note', e.target.value.slice(0, 255))}
          placeholder="Add a note"
          maxLength={255}
        />
      </section>

      <WizardFooter>
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed} size="lg">
          Review
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </WizardFooter>
    </div>
  )
}

// ─── Step 3: Review ───────────────────────────────────────────────────────────

function StepReview({
  state,
  fromCard,
  txTypes,
  onSubmit,
  onBack,
  isSubmitting,
  error,
}) {
  const { maskCard } = useCardBrandResolver()
  const txType = txTypes.find((t) => t.transaction_type_id === state.txTypeId)
  const recipientNameParts = state.recipientInfo?.owner_name?.split(' ') ?? []

  return (
    <div className="space-y-4">
      {/* Recipient confirmation */}
      {state.recipientInfo && (
        <div className="flex items-center gap-4 rounded-surface bg-primary/8 p-4 ring-1 ring-primary/25">
          <UserAvatar
            user={{
              first_name: recipientNameParts[0],
              last_name: recipientNameParts.slice(1).join(' '),
              avatar_url: state.recipientInfo.avatar_url,
            }}
            className="h-12 w-12 text-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Confirm recipient
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-card-foreground">
              {state.recipientInfo.owner_name}
            </p>
            <p className="truncate text-xs font-medium text-muted-foreground">
              {state.recipientInfo.owner_email}
              <span aria-hidden="true"> · </span>
              card ****{state.recipientInfo.last_four}
            </p>
          </div>
        </div>
      )}

      {/* Summary list */}
      <dl className="overflow-hidden rounded-surface bg-card text-sm ring-1 ring-border">
        <ReceiptRow
          label="From"
          value={fromCard ? maskCard(fromCard) : '—'}
          mono
        />
        <ReceiptRow label="Type" value={txType?.name} capitalize />
        {state.note && <ReceiptRow label="Note" value={state.note} />}
        <div className="flex items-center justify-between gap-4 bg-muted/40 px-4 py-4">
          <dt className="text-sm font-bold text-card-foreground">Total</dt>
          <dd className="tabular-nums text-xl font-bold tracking-tight text-card-foreground">
            {formatMoney(state.amount)}
          </dd>
        </div>
      </dl>

      <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
        <Info
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span>
          Sensitive payments (fines and amounts over $100) are held until you
          confirm with your password or authenticator code.
        </span>
      </p>

      {error && <FormBanner variant="error" message={error} />}

      <WizardFooter>
        <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          size="lg"
        >
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
      </WizardFooter>
    </div>
  )
}

function ReceiptRow({ label, value, capitalize, mono }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3 last:border-b-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`text-right text-sm font-semibold text-card-foreground ${
          capitalize ? 'capitalize' : ''
        } ${mono ? 'font-mono' : ''}`}
      >
        {value ?? '—'}
      </dd>
    </div>
  )
}

// ─── Step 4: Success ──────────────────────────────────────────────────────────

function StepResult({ amount, recipientName, onClose }) {
  useEffect(() => {
    const timeout = setTimeout(onClose, AUTO_CLOSE_MS)
    return () => clearTimeout(timeout)
  }, [onClose])

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
          Payment sent
        </p>
        <p className="tabular-nums text-4xl font-bold tracking-tight text-card-foreground sm:text-5xl">
          {formatMoney(amount)}
        </p>
        {recipientName && (
          <p className="text-sm text-muted-foreground">to {recipientName}</p>
        )}
      </div>

      <Button variant="outline" onClick={onClose} className="w-full">
        Done
      </Button>
    </div>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function WizardFooter({ children }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-6 mt-8 flex items-center justify-between gap-3 border-t border-border bg-background px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:-mx-7 sm:px-7 md:static md:z-auto md:mx-0 md:bg-transparent md:px-0 md:py-0 md:pb-0 md:pt-5">
      {children}
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

const INITIAL_FORM = {
  fromCardId: null,
  txTypeId: null,
  recipientMode: 'email',
  recipientCardNumber: '',
  recipientEmailQuery: '',
  recipientInfo: null,
  amount: '',
  note: '',
}

const STEP_HEADINGS = [
  'Choose a card',
  'Add a recipient and amount',
  'Confirm the transfer',
  'Payment sent',
]

export default function PaymentWizard({
  isOpen,
  onClose,
  onSuccess,
  initialCardId = null,
}) {
  const { user } = useAuth()
  const { notify } = useNotifications()
  const { maskCard, resolveBrand } = useCardBrandResolver()
  const currentUserId = user?.user_id ?? user?.id

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL_FORM)
  const [cards, setCards] = useState([])
  const [txTypes, setTxTypes] = useState([])
  const [isLoadingRef, setIsLoadingRef] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [retryToken, setRetryToken] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [pendingApprovalTx, setPendingApprovalTx] = useState(null)
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)
  const idempotencyKeyRef = useRef(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setStep(initialCardId ? 1 : 0)
    setForm({ ...INITIAL_FORM, fromCardId: initialCardId ?? null })
    setSubmitError('')
    setShowCloseConfirm(false)
  }, [isOpen, initialCardId])

  useEffect(() => {
    if (!isOpen || !user) return
    setIsLoadingRef(true)
    setLoadError('')

    Promise.all([
      listCards({ user_id: user.id, limit: 100 }),
      transactionTypesService.list(),
    ])
      .then(([rawCards, rawTypes]) => {
        setCards(rawCards.filter((c) => !c.deleted_at))
        const sendableTypes = rawTypes.filter((t) => SEND_TYPE_NAMES.has(t.name))
        setTxTypes(sendableTypes)
        const defaultType =
          sendableTypes.find((t) => t.name === 'payment') ?? sendableTypes[0] ?? null
        if (defaultType) {
          setForm((prev) =>
            prev.txTypeId
              ? prev
              : { ...prev, txTypeId: defaultType.transaction_type_id }
          )
        }
      })
      .catch(() => {
        setLoadError("Couldn't load your cards. Check your connection and try again.")
      })
      .finally(() => setIsLoadingRef(false))
  }, [isOpen, user, retryToken])

  function resetAndClose() {
    setStep(0)
    setForm(INITIAL_FORM)
    setSubmitError('')
    setPendingApprovalTx(null)
    setApprovalModalOpen(false)
    idempotencyKeyRef.current = null
    setShowCloseConfirm(false)
    onClose()
  }

  function hasWizardProgress() {
    if (step === 0 || step === 3) return false
    return Boolean(
      form.recipientCardNumber ||
        form.recipientEmailQuery ||
        form.recipientInfo ||
        form.amount ||
        form.note
    )
  }

  function requestClose() {
    if (hasWizardProgress()) {
      setShowCloseConfirm(true)
      return
    }
    resetAndClose()
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    if (isSubmitting) return

    setSubmitError('')
    setIsSubmitting(true)

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = createIdempotencyKey()
    }

    try {
      const normalizedAmount = normalizeAmountForSubmit(form.amount)
      if (!normalizedAmount) {
        setSubmitError('Enter a valid amount with up to 2 decimal places.')
        return
      }

      const created = await transactionsService.create({
        sender_card_id: form.fromCardId,
        recipient_card_id: form.recipientInfo.card_id,
        transaction_type_id: form.txTypeId,
        amount: normalizedAmount,
        note: form.note || null,
        idempotency_key: idempotencyKeyRef.current,
      })

      if (created?.awaiting_user_approval || created?.requires_user_approval) {
        setPendingApprovalTx(created)
        setApprovalModalOpen(true)
        return
      }

      setStep(3)

      const isSelfTransfer = form.recipientInfo.user_id === user?.id
      const txLink = created?.transaction_id
        ? { route: '/payments', modal: { kind: 'transaction', id: created.transaction_id } }
        : { route: '/payments' }

      if (isSelfTransfer) {
        notify({
          type: 'success',
          category: CATEGORIES.PAYMENT_SELF,
          message: `Transferred ${formatMoney(form.amount)} to your card ****${form.recipientInfo.last_four}.`,
          link: txLink,
        })
      } else {
        notify({
          type: 'success',
          category: CATEGORIES.PAYMENT_SENT,
          message: `${formatMoney(form.amount)} sent to ${form.recipientInfo.owner_name}.`,
          link: txLink,
        })
      }

      emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
      onSuccess?.()
    } catch (err) {
      setSubmitError(
        err?.message || 'Payment failed. Please check the details and try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleApprovalComplete() {
    setApprovalModalOpen(false)
    setStep(3)
    notify({
      type: 'success',
      category: CATEGORIES.PAYMENT_SENT,
      message: `${formatMoney(form.amount)} approved and will settle shortly.`,
      link: pendingApprovalTx?.transaction_id
        ? { route: '/payments', modal: { kind: 'transaction', id: pendingApprovalTx.transaction_id } }
        : { route: '/payments' },
    })
    emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
    onSuccess?.()
  }

  const fromCard = cards.find((c) => c.card_id === form.fromCardId) ?? null
  const txType = txTypes.find((t) => t.transaction_type_id === form.txTypeId)
  const isSuccess = step === 3

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      variant="split"
      size={isSuccess ? 'lg' : '3xl'}
    >
      {isSuccess ? (
        <div className="px-6 pt-5 pb-6 sm:px-7 sm:pb-7">
          <ModalTitle className="sr-only">Payment sent</ModalTitle>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetAndClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-pill bg-muted/50 text-muted-foreground transition-colors touch-manipulation md:h-8 md:w-8 hover:bg-muted hover:text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Close modal"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>
          <StepResult
            amount={form.amount}
            recipientName={form.recipientInfo?.owner_name}
            onClose={resetAndClose}
          />
        </div>
      ) : (
        <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <LeftPanel
            step={step}
            form={form}
            fromCard={fromCard}
            txTypeName={txType?.name}
            maskCard={maskCard}
            resolveBrand={resolveBrand}
          />

          <div className="flex min-h-128 flex-col px-6 pt-5 pb-6 sm:px-7 sm:pb-7">
            <header className="mb-5 flex items-start justify-between gap-3">
              <ModalTitle className="text-base font-semibold leading-tight text-card-foreground">
                {STEP_HEADINGS[step]}
              </ModalTitle>
              <button
                type="button"
                onClick={requestClose}
                className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-pill bg-muted/50 text-muted-foreground transition-colors touch-manipulation md:h-8 md:w-8 hover:bg-muted hover:text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Close modal"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </header>

            <div className="mb-6">
              <StepProgress current={step} />
            </div>

            <div className="flex-1">
              {isLoadingRef ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : loadError ? (
                <div className="space-y-3 py-8">
                  <FormBanner variant="error" message={loadError} />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-input"
                    onClick={() => setRetryToken((t) => t + 1)}
                  >
                    Try again
                  </Button>
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
              ) : (
                <StepReview
                  state={form}
                  fromCard={fromCard}
                  txTypes={txTypes}
                  onSubmit={handleSubmit}
                  onBack={() => setStep(1)}
                  isSubmitting={isSubmitting}
                  error={submitError}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {showCloseConfirm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[3px] animate-in fade-in-0 duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCloseConfirm(false)
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-confirm-title"
        >
          <div className="bg-background border border-border/60 rounded-panel w-full max-w-md relative animate-in fade-in-0 zoom-in-85 slide-in-from-bottom-14 duration-500 ease-[cubic-bezier(0.34,1.45,0.64,1)]">
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
              <div className="min-w-0 pt-0.5">
                <h2
                  id="discard-confirm-title"
                  className="text-lg sm:text-xl font-semibold leading-tight tracking-tight text-card-foreground"
                >
                  Discard this payment?
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Your recipient and amount will be cleared. You can start again any time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-pill bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Close confirmation"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>
            <div className="px-6 pb-6 sm:px-7 sm:pb-7">
              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCloseConfirm(false)}
                  className="text-card-foreground"
                >
                  Keep editing
                </Button>
                <Button type="button" variant="destructive" onClick={resetAndClose}>
                  Discard
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PaymentApprovalModal
        isOpen={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false)
          notify({
            type: 'info',
            category: CATEGORIES.PAYMENT_SENT,
            message: 'Payment is pending your approval. Open it from your history to confirm.',
            link: pendingApprovalTx?.transaction_id
              ? { route: '/payments', modal: { kind: 'transaction', id: pendingApprovalTx.transaction_id } }
              : { route: '/payments' },
          })
          emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
          onSuccess?.()
          resetAndClose()
        }}
        transaction={pendingApprovalTx}
        onApproved={handleApprovalComplete}
      />
    </Modal>
  )
}
