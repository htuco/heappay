import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookmarkPlus,
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
import { Select } from '@/components/ui/select'
import FormBanner from '@/components/ui/FormBanner'
import AppPinPad from '@/components/payment/AppPinPad'
import UserAvatar from '@/components/ui/UserAvatar'
import RecipientPicker from '@/components/payment/RecipientPicker'
import {
  CardOption,
  FieldLabel,
  ReceiptRow,
  SegmentedControl,
  StepProgress,
  WizardFooter,
} from '@/components/payment/wizardPrimitives'
import { buildCategoryOptions } from '@/components/payment/transactionHistory.utils'
import { useAppSelector } from '@/store/hooks'
import { selectTransactionCategories } from '@/store/slices/referenceDataSlice'
import { useAuth } from '@/hooks/useAuth'
import { useCardBrandResolver } from '@/hooks/useCardBrandResolver'
import { formatBrandLabel } from '@/utils/paymentCard.utils'
import CardBrandIcon from '@/components/ui/CardBrandIcon'
import { useNotifications } from '@/context/NotificationContext'
import { CATEGORIES } from '@/context/notifications/categories'
import { listCards, lookupCardByNumber } from '@/services/cardsService'
import { getAppPinStatus, getBiometricStatus } from '@/services/authService'
import transactionTypesService from '@/services/transactionTypesService'
import transactionsService from '@/services/transactionsService'
import transactionDraftsService from '@/services/transactionDraftsService'
import { DATA_CHANGE_KINDS, emitDataChange } from '@/utils/dataEvents'
import { formatMoney, normalizeAmountForSubmit, sanitizeAmountInput } from '@/utils/amount'
import { createIdempotencyKey } from '@/utils/idempotency'
import PaymentApprovalModal from '@/components/payment/PaymentApprovalModal'
import PaymentSendConfirmModal from '@/components/payment/PaymentSendConfirmModal'
import { getBiometricAssertion, isWebAuthnAssertionAvailable } from '@/utils/webauthn'
import { paymentConfirmationLabel, userRequiresPaymentConfirmation } from '@/utils/paymentSecurity'

const SEND_TYPE_NAMES = new Set(['payment', 'fine'])
const AUTO_CLOSE_MS = 1200
const QUICK_AMOUNTS = [10, 25, 50]

function formatCardNumber(value) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}

function formatAmount(value) {
  return sanitizeAmountInput(value)
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

const STEP_LABELS = ['From', 'To & Amount', 'Review']

// ─── Left context panel ──────────────────────────────────────────────────────

/** Saves the half-finished payment and closes the wizard. Sends nothing. */
function SaveDraftButton({ onClick, isSaving, disabled = false }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={isSaving || disabled}
      aria-busy={isSaving}
      className="text-card-foreground"
    >
      {isSaving ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <BookmarkPlus className="mr-1.5 h-4 w-4" />
      )}
      Save as draft
    </Button>
  )
}

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

function StepTo({
  state,
  onChange,
  fromCard,
  onNext,
  onBack,
  currentUserId,
  lockedRecipient = null,
  onSaveDraft,
  isSavingDraft,
  draftError,
}) {
  const [lookupState, setLookupState] = useState(
    state.recipientInfo
      ? { status: 'found', info: state.recipientInfo }
      : { status: 'idle' }
  )
  const [recipientError, setRecipientError] = useState('')
  // When the payment was opened from a saved contact the recipient is fixed.
  // Show it read-only so a stray keystroke can't silently redirect the money;
  // "Change" unlocks the normal picker.
  const [isChangingRecipient, setIsChangingRecipient] = useState(false)
  const recipientLocked = Boolean(lockedRecipient) && !isChangingRecipient

  function unlockRecipient() {
    setIsChangingRecipient(true)
    onChange('recipientInfo', null)
    onChange('recipientCardNumber', '')
    onChange('recipientEmailQuery', '')
    setLookupState({ status: 'idle' })
    setRecipientError('')
  }
  const debounceRef = useRef(null)
  const amountInputRef = useRef(null)
  const categories = useAppSelector(selectTransactionCategories)
  const categoryOptions = buildCategoryOptions(categories)

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
        {recipientLocked ? (
          <>
            <FieldLabel>Recipient</FieldLabel>
            <div className="flex items-center gap-3 rounded-input border border-success/30 bg-success/8 px-3 py-2.5">
              <UserAvatar
                user={{
                  full_name: lockedRecipient.owner_name,
                  avatar_url: lockedRecipient.avatar_url,
                }}
                className="h-9 w-9 text-xs ring-1 ring-success/30"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-card-foreground">
                  {lockedRecipient.owner_name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {lockedRecipient.owner_email} · ****{lockedRecipient.last_four}
                </p>
              </div>
              <button
                type="button"
                onClick={unlockRecipient}
                className="shrink-0 text-xs font-semibold text-primary hover:underline"
              >
                Change
              </button>
            </div>
          </>
        ) : (
          <>
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
          </>
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

      {categoryOptions.length > 0 ? (
        <section className="space-y-2">
          <FieldLabel htmlFor="payment-category" hint="Optional">
            Category
          </FieldLabel>
          <Select
            id="payment-category"
            value={state.categoryId != null ? String(state.categoryId) : ''}
            onChange={(e) =>
              onChange('categoryId', e.target.value === '' ? null : Number(e.target.value))
            }
            options={[{ value: '', label: 'No category' }, ...categoryOptions]}
          />
        </section>
      ) : null}

      {draftError && <FormBanner variant="error" message={draftError} />}

      <WizardFooter>
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <SaveDraftButton onClick={onSaveDraft} isSaving={isSavingDraft} />
          <Button onClick={onNext} disabled={!canProceed} size="lg">
            Review
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
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
  confirmationHint,
  onSaveDraft,
  isSavingDraft,
  draftError,
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
          {confirmationHint}
        </span>
      </p>

      {error && <FormBanner variant="error" message={error} />}
      {draftError && <FormBanner variant="error" message={draftError} />}

      <WizardFooter>
        <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <SaveDraftButton
            onClick={onSaveDraft}
            isSaving={isSavingDraft}
            disabled={isSubmitting}
          />
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
        </div>
      </WizardFooter>
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
  categoryId: null,
}

const STEP_HEADINGS = [
  'Choose a card',
  'Add a recipient and amount',
  'Confirm the transfer',
  'Payment sent',
]

/** The recipient shape the wizard uses, rebuilt from a draft's stored card. */
function draftRecipientInfo(draft) {
  const recipient = draft?.recipient
  if (!recipient) return null
  const fullName = [recipient.first_name, recipient.last_name].filter(Boolean).join(' ')
  return {
    card_id: recipient.card_id,
    user_id: recipient.user_id,
    owner_name: fullName || recipient.cardholder_name || recipient.email || 'Unknown',
    owner_email: recipient.email ?? '',
    last_four: recipient.last_four,
    avatar_url: recipient.avatar_url,
    masked_card_number: recipient.last_four ? `•••• ${recipient.last_four}` : '',
  }
}

/** A saved draft, back in the shape the wizard edits. */
function draftToForm(draft) {
  const recipientInfo = draftRecipientInfo(draft)
  return {
    ...INITIAL_FORM,
    fromCardId: draft.sender_card_id ?? null,
    txTypeId: draft.transaction_type_id ?? null,
    recipientInfo,
    recipientCardNumber: recipientInfo?.masked_card_number ?? '',
    amount: draft.amount != null ? String(draft.amount) : '',
    note: draft.note ?? '',
    categoryId: draft.category_id ?? null,
  }
}

export default function PaymentWizard({
  isOpen,
  onClose,
  onSuccess,
  initialCardId = null,
  initialRecipient = null,
  // A draft being resumed: prefills the form and makes this wizard edit that
  // draft rather than start a new payment. Sending consumes it server-side.
  initialDraft = null,
  initialStep = null,
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
  const [pinConfirmOpen, setPinConfirmOpen] = useState(false)
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinSubtitle, setPinSubtitle] = useState('Enter your app PIN to send this payment.')
  const [isPinSubmitting, setIsPinSubmitting] = useState(false)
  const idempotencyKeyRef = useRef(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  // Set while this wizard is editing a saved draft. It decides two things:
  // whether "Save as draft" updates or creates, and whether sending goes
  // through the draft (which consumes it) or straight to create.
  const [draftId, setDraftId] = useState(null)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [draftError, setDraftError] = useState('')

  const resumedRecipient = initialDraft ? draftRecipientInfo(initialDraft) : null
  const lockedRecipient = initialRecipient ?? resumedRecipient

  useEffect(() => {
    if (!isOpen) return
    const draftForm = initialDraft ? draftToForm(initialDraft) : null
    setDraftId(initialDraft?.draft_id ?? null)
    setStep(initialStep ?? (draftForm?.fromCardId || initialCardId ? 1 : 0))
    setForm(
      draftForm ?? {
        ...INITIAL_FORM,
        fromCardId: initialCardId ?? null,
        recipientInfo: initialRecipient ?? null,
        recipientMode: 'email',
      }
    )
    setSubmitError('')
    setDraftError('')
    setPinConfirmOpen(false)
    setSendConfirmOpen(false)
    setPin('')
    setPinError('')
    setShowCloseConfirm(false)
  }, [isOpen, initialCardId, initialRecipient, initialDraft, initialStep])

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
    setDraftId(null)
    setDraftError('')
    setIsSavingDraft(false)
    setSubmitError('')
    setPendingApprovalTx(null)
    setApprovalModalOpen(false)
    setPinConfirmOpen(false)
    setSendConfirmOpen(false)
    setPin('')
    setPinError('')
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

  async function getCreateBiometricPayload() {
    const status = await getBiometricStatus()
    if (!status.enabled) return null

    if (!window.HeapNativeBiometrics?.getAssertion && !isWebAuthnAssertionAvailable()) {
      throw new Error('Biometric authentication is not available on this device or browser.')
    }

    const options = await transactionsService.beginBiometricTransactionVerification()
    const credential = await getBiometricAssertion(options.publicKey)
    return {
      challenge_id: options.challenge_id,
      credential,
    }
  }

  async function getCreateAppPinRequired() {
    const status = await getAppPinStatus()
    return Boolean(status.enabled)
  }

  function openPinConfirmation(message = 'Enter your app PIN to send this payment.') {
    setPin('')
    setPinError('')
    setPinSubtitle(message)
    setPinConfirmOpen(true)
  }

  /** Persist the half-finished payment and close. Nothing is charged or held. */
  async function handleSaveDraft() {
    if (isSavingDraft) return
    setDraftError('')

    // A draft is allowed to be incomplete, but not to be wrong: an amount the
    // user typed either survives the round trip or they get told why not.
    let amount = null
    if (form.amount !== '') {
      amount = normalizeAmountForSubmit(form.amount)
      if (!amount) {
        setDraftError('Enter a valid amount with up to 2 decimal places, or clear it.')
        return
      }
    }

    setIsSavingDraft(true)
    try {
      const payload = {
        sender_card_id: form.fromCardId ?? null,
        recipient_card_id: form.recipientInfo?.card_id ?? null,
        transaction_type_id: form.txTypeId ?? null,
        category_id: form.categoryId ?? null,
        amount,
        note: form.note || null,
      }
      if (draftId) {
        await transactionDraftsService.update(draftId, payload)
      } else {
        await transactionDraftsService.create(payload)
      }
      notify({
        type: 'success',
        category: CATEGORIES.PAYMENT_SENT,
        message: 'Payment saved as a draft. Finish it any time from Transactions.',
        link: { route: '/transactions' },
      })
      emitDataChange(DATA_CHANGE_KINDS.TRANSACTION_DRAFT)
      resetAndClose()
    } catch (err) {
      setDraftError(err?.message || "Couldn't save this draft. Please try again.")
    } finally {
      setIsSavingDraft(false)
    }
  }

  async function submitPayment(confirmation = {}) {
    const normalizedAmount = normalizeAmountForSubmit(form.amount)
    if (!normalizedAmount) {
      throw new Error('Enter a valid amount with up to 2 decimal places.')
    }

    const body = {
      sender_card_id: form.fromCardId,
      recipient_card_id: form.recipientInfo.card_id,
      transaction_type_id: form.txTypeId,
      amount: normalizedAmount,
      note: form.note || null,
      category_id: form.categoryId ?? null,
      idempotency_key: idempotencyKeyRef.current,
      ...confirmation,
    }

    // Sending a resumed draft goes through the draft's own send endpoint: same
    // create path on the server, but the draft is consumed in the same request
    // rather than left behind for the user to discard by hand. A failed send
    // raises before the draft is touched, so it is still there to retry.
    const created = draftId
      ? await transactionDraftsService.send(draftId, body)
      : await transactionsService.create(body)

    if (draftId) {
      emitDataChange(DATA_CHANGE_KINDS.TRANSACTION_DRAFT)
    }

    if (created?.awaiting_user_approval || created?.requires_user_approval) {
      setPendingApprovalTx(created)
      setApprovalModalOpen(true)
      return
    }

    setStep(3)

    const isSelfTransfer = form.recipientInfo.user_id === user?.id
    const txLink = created?.transaction_id
      ? { route: '/transactions', modal: { kind: 'transaction', id: created.transaction_id } }
      : { route: '/transactions' }

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

      const biometric = await getCreateBiometricPayload()
      if (biometric) {
        await submitPayment({ biometric })
      } else if (await getCreateAppPinRequired()) {
        openPinConfirmation('Enter your app PIN to send this payment.')
      } else if (userRequiresPaymentConfirmation(user, normalizedAmount)) {
        setSendConfirmOpen(true)
      } else {
        await submitPayment()
      }
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        if (await getCreateAppPinRequired()) {
          openPinConfirmation('Biometric verification was cancelled. Use your app PIN to continue.')
        } else {
          setSubmitError('Biometric verification was cancelled. Payment was not sent.')
        }
        return
      }
      if (err?.message?.toLowerCase().includes('biometric')) {
        if (await getCreateAppPinRequired()) {
          openPinConfirmation('Biometrics are unavailable right now. Use your app PIN to continue.')
        } else {
          setSubmitError('Biometrics are unavailable right now. Payment was not sent.')
        }
        return
      }
      setSubmitError(
        err?.message || 'Payment failed. Please check the details and try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSendConfirm(confirmation) {
    await submitPayment(confirmation)
    setSendConfirmOpen(false)
  }

  async function handlePinSubmit() {
    if (isPinSubmitting || pin.length !== 4) return
    setPinError('')
    setIsPinSubmitting(true)
    try {
      await submitPayment({ app_pin: pin })
      setPinConfirmOpen(false)
    } catch (err) {
      setPin('')
      setPinError(err?.message || 'Could not confirm app PIN. Try again.')
    } finally {
      setIsPinSubmitting(false)
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
        ? { route: '/transactions', modal: { kind: 'transaction', id: pendingApprovalTx.transaction_id } }
        : { route: '/transactions' },
    })
    emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
    onSuccess?.()
  }

  const fromCard = cards.find((c) => c.card_id === form.fromCardId) ?? null
  const txType = txTypes.find((t) => t.transaction_type_id === form.txTypeId)
  const isSuccess = step === 3
  const confirmationHint = user?.totp_enabled
    ? 'Confirm with Face ID / fingerprint, app PIN, or your authenticator code before money is sent.'
    : 'Confirm with Face ID / fingerprint, app PIN, or your password before money is sent. ' +
      paymentConfirmationLabel(user)

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
              <StepProgress labels={STEP_LABELS} current={step} />
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
                  lockedRecipient={lockedRecipient}
                  onSaveDraft={handleSaveDraft}
                  isSavingDraft={isSavingDraft}
                  draftError={draftError}
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
                  confirmationHint={confirmationHint}
                  onSaveDraft={handleSaveDraft}
                  isSavingDraft={isSavingDraft}
                  draftError={draftError}
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
                  Your recipient and amount will be cleared — or save them as a draft
                  and finish this payment later.
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
              {draftError && <FormBanner variant="error" message={draftError} />}
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCloseConfirm(false)}
                  className="text-card-foreground"
                >
                  Keep editing
                </Button>
                <SaveDraftButton onClick={handleSaveDraft} isSaving={isSavingDraft} />
                <Button type="button" variant="destructive" onClick={resetAndClose}>
                  Discard
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pinConfirmOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[3px] animate-in fade-in-0 duration-200"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isPinSubmitting) {
              setPinConfirmOpen(false)
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-pin-title"
        >
          <div className="w-full max-w-sm rounded-panel border border-border/60 bg-background px-6 py-6 shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-8 duration-300">
            <p id="payment-pin-title" className="sr-only">
              Confirm payment with app PIN
            </p>
            <AppPinPad
              value={pin}
              onChange={setPin}
              onSubmit={handlePinSubmit}
              isSubmitting={isPinSubmitting}
              error={pinError}
              title="Confirm with app PIN"
              subtitle={pinSubtitle}
              submitLabel="Send payment"
              cancelLabel="Back"
              onCancel={() => setPinConfirmOpen(false)}
            />
          </div>
        </div>
      )}

      <PaymentSendConfirmModal
        isOpen={sendConfirmOpen}
        onClose={() => setSendConfirmOpen(false)}
        amount={form.amount}
        recipientName={form.recipientInfo?.owner_name}
        onConfirm={handleSendConfirm}
      />

      <PaymentApprovalModal
        isOpen={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false)
          notify({
            type: 'info',
            category: CATEGORIES.PAYMENT_SENT,
            message: 'Payment is pending your approval. Open it from your history to confirm.',
            link: pendingApprovalTx?.transaction_id
              ? { route: '/transactions', modal: { kind: 'transaction', id: pendingApprovalTx.transaction_id } }
              : { route: '/transactions' },
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
