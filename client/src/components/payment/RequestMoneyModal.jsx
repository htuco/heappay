import { useEffect, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  HandCoins,
  Loader2,
  X,
} from 'lucide-react'
import { Modal, ModalTitle } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import FormBanner from '@/components/ui/FormBanner'
import UserAvatar from '@/components/ui/UserAvatar'
import RecipientPicker from '@/components/payment/RecipientPicker'
import {
  FieldLabel,
  ReceiptRow,
  StepProgress,
  WizardFooter,
} from '@/components/payment/wizardPrimitives'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/context/NotificationContext'
import { CATEGORIES } from '@/context/notifications/categories'
import transactionsService from '@/services/transactionsService'
import { DATA_CHANGE_KINDS, emitDataChange } from '@/utils/dataEvents'
import { formatMoney, normalizeAmountForSubmit, sanitizeAmountInput } from '@/utils/amount'

const AUTO_CLOSE_MS = 1200
const QUICK_AMOUNTS = [10, 25, 50]
const STEP_LABELS = ['Recipient', 'Review']

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
          Request sent
        </p>
        <p className="tabular-nums text-4xl font-bold tracking-tight text-card-foreground sm:text-5xl">
          {formatMoney(amount)}
        </p>
        {recipientName && (
          <p className="text-sm text-muted-foreground">from {recipientName}</p>
        )}
      </div>
      <Button variant="outline" onClick={onClose} className="w-full">
        Done
      </Button>
    </div>
  )
}

const INITIAL = {
  query: '',
  recipient: null,
  amount: '',
  note: '',
}

export default function RequestMoneyModal({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth()
  const { notify } = useNotifications()
  const currentUserId = user?.id ?? user?.user_id ?? null

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setStep(0)
    setForm(INITIAL)
    setSubmitError('')
    setIsSubmitting(false)
  }, [isOpen])

  function resetAndClose() {
    setForm(INITIAL)
    setStep(0)
    setSubmitError('')
    onClose?.()
  }

  const normalizedAmount = normalizeAmountForSubmit(form.amount)
  const canContinue = Boolean(form.recipient) && Boolean(normalizedAmount)
  const isSuccess = step === 2

  async function handleSubmit() {
    if (isSubmitting) return
    if (form.recipient?.user_id === currentUserId) {
      setSubmitError('You cannot request money from yourself.')
      return
    }
    if (!form.recipient?.user_id || !normalizedAmount) {
      setSubmitError('Pick a recipient and enter a valid amount.')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')
    try {
      await transactionsService.requestMoney({
        targetUserId: form.recipient.user_id,
        amount: normalizedAmount,
        note: form.note || null,
      })
      notify({
        type: 'success',
        category: CATEGORIES.MONEY_REQUEST_SENT,
        message: `You requested ${formatMoney(form.amount)} from ${form.recipient.owner_name}.`,
        link: { route: '/transactions' },
      })
      emitDataChange(DATA_CHANGE_KINDS.MONEY_REQUEST)
      setStep(2)
      onSuccess?.()
    } catch (err) {
      setSubmitError(err?.message || 'Could not send this request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const recipient = form.recipient
  const nameParts = recipient?.owner_name?.split(' ') ?? []

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      variant="split"
      size={isSuccess ? 'lg' : '3xl'}
    >
      {isSuccess ? (
        <div className="px-6 pt-5 pb-6 sm:px-7 sm:pb-7">
          <ModalTitle className="sr-only">Request sent</ModalTitle>
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
            recipientName={recipient?.owner_name}
            onClose={resetAndClose}
          />
        </div>
      ) : (
        <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <aside className="hidden flex-col gap-5 bg-muted/40 p-6 md:flex">
            <p className="text-xs font-bold uppercase tracking-widest text-foreground/70">
              Request Money
            </p>
            {recipient ? (
              <div className="flex items-center gap-3 rounded-surface bg-card p-4 ring-1 ring-border shadow-sm">
                <UserAvatar
                  user={{
                    first_name: nameParts[0],
                    last_name: nameParts.slice(1).join(' '),
                    avatar_url: recipient.avatar_url,
                  }}
                  className="h-10 w-10 text-xs"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-card-foreground">
                    {recipient.owner_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {recipient.owner_email}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-surface border border-dashed border-border bg-card/40 px-4 py-5 text-center text-xs text-muted-foreground">
                Pick someone from your contacts or search by email.
              </div>
            )}
            <div className="mt-auto rounded-surface bg-card/60 p-4 ring-1 ring-border/60">
              <p className="text-xs leading-relaxed text-muted-foreground">
                They&apos;ll get an in-app notification and can pay or decline from
                Transactions. You&apos;re asking — nothing leaves anyone&apos;s card yet.
              </p>
            </div>
          </aside>

          <div className="flex min-h-0 flex-col px-6 py-5 sm:px-7 sm:py-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <ModalTitle className="text-lg font-semibold text-card-foreground">
                  {step === 0 ? 'Who should pay you?' : 'Review request'}
                </ModalTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step === 0
                    ? 'Choose a contact or type an email, then enter an amount.'
                    : 'Confirm the details before sending this request.'}
                </p>
              </div>
              <button
                type="button"
                onClick={resetAndClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-pill bg-muted/50 text-muted-foreground transition-colors touch-manipulation md:h-8 md:w-8 hover:bg-muted hover:text-card-foreground"
                aria-label="Close modal"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>

            <StepProgress labels={STEP_LABELS} current={step} />

            <div className="mt-6 flex-1 space-y-5">
              {step === 0 && (
                <>
                  <RecipientPicker
                    query={form.query}
                    onQueryChange={(query) =>
                      setForm((prev) => ({ ...prev, query, recipient: null }))
                    }
                    selectedRecipient={form.recipient}
                    onSelect={(recipient) =>
                      setForm((prev) => ({ ...prev, recipient, query: '' }))
                    }
                    currentUserId={currentUserId}
                  />

                  <div className="space-y-2">
                    <FieldLabel htmlFor="request-amount">Amount</FieldLabel>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="request-amount"
                        value={form.amount}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            amount: sanitizeAmountInput(e.target.value),
                          }))
                        }
                        inputMode="decimal"
                        placeholder="0.00"
                        className="pl-7"
                      />
                    </div>
                    <div className="flex gap-2">
                      {QUICK_AMOUNTS.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({ ...prev, amount: String(value) }))
                          }
                          className="rounded-chip border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-card-foreground"
                        >
                          ${value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <FieldLabel htmlFor="request-note" hint="Optional">
                      Note
                    </FieldLabel>
                    <Input
                      id="request-note"
                      value={form.note}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, note: e.target.value }))
                      }
                      maxLength={255}
                      placeholder="What's this for?"
                    />
                  </div>
                </>
              )}

              {step === 1 && (
                <dl className="overflow-hidden rounded-surface border border-border bg-card">
                  <ReceiptRow label="From" value={recipient?.owner_name} />
                  <ReceiptRow label="Email" value={recipient?.owner_email} />
                  <ReceiptRow label="Amount" value={formatMoney(form.amount)} />
                  <ReceiptRow label="Note" value={form.note || '—'} />
                </dl>
              )}

              <FormBanner variant="error" message={submitError} />
            </div>

            <WizardFooter>
              {step === 0 ? (
                <span />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSubmitError('')
                    setStep(0)
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              {step === 0 ? (
                <Button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={!canContinue}
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !canContinue}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <HandCoins className="h-4 w-4" />
                  )}
                  Send request
                </Button>
              )}
            </WizardFooter>
          </div>
        </div>
      )}
    </Modal>
  )
}
