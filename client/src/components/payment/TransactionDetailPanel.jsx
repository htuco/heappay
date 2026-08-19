import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  MoveRight,
  Info,
  Loader2,
  ReceiptText,
  RotateCcw,
  Save,
  Share2,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import UserAvatar from '@/components/ui/UserAvatar'
import PaymentApprovalModal from '@/components/payment/PaymentApprovalModal'
import { useAuth } from '@/hooks/useAuth'
import { useAppSelector } from '@/store/hooks'
import { selectTransactionCategories } from '@/store/slices/referenceDataSlice'
import useTransactionDetail from '@/hooks/useTransactionDetail'
import {
  buildCategoryOptions,
  getTransactionStatus,
} from '@/components/payment/transactionHistory.utils'
import transactionsService from '@/services/transactionsService'
import { DATA_CHANGE_KINDS, emitDataChange } from '@/utils/dataEvents'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'

const TYPE_LABEL = { 1: 'Deposit', 2: 'Payment', 3: 'Refund', 4: 'Withdrawal', 5: 'Chargeback', 6: 'Fine' }

// Pre-check copy for the refund button when a refund already exists for this
// transaction (a transaction can have at most one refund ever). `refund_status`
// comes straight from the transaction detail response — no extra round-trip.
const REFUND_STATUS_UI = {
  pending: { button: 'Refund requested', note: 'Refund request created. The review team will process it.' },
  approved: { button: 'Refund approved', note: 'This transaction has already been refunded.' },
  declined: { button: 'Refund declined', note: 'A refund for this transaction was declined. That decision is final.' },
  cancelled: { button: 'Refund cancelled', note: 'A previous refund request for this transaction was cancelled.' },
}
const CLOSE_ANIMATION_MS = 240
const PANEL_ENTER_ANIMATION =
  'animate-[transaction-detail-slide-in_240ms_cubic-bezier(0.16,1,0.3,1)_both]'
const PANEL_EXIT_ANIMATION =
  'animate-[transaction-detail-slide-out_240ms_cubic-bezier(0.7,0,0.84,0)_both]'
const OVERLAY_ENTER_ANIMATION = 'animate-[transaction-detail-fade-in_220ms_ease-out_both]'
const OVERLAY_EXIT_ANIMATION = 'animate-[transaction-detail-fade-out_240ms_ease-in_both]'

function getTransactionId(transaction) {
  return transaction?.transaction_id ?? transaction?.id ?? transaction?.payment_id ?? null
}

function formatDate(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getTypeLabel(transaction) {
  return (
    transaction?.transaction_type?.name ??
    transaction?.type?.name ??
    transaction?.type ??
    TYPE_LABEL[transaction?.transaction_type_id] ??
    'Transaction'
  )
}

function getStatusLabel(transaction) {
  return (
    transaction?.status?.name ??
    transaction?.status ??
    getTransactionStatus(Number(transaction?.status_id)).label
  )
}

function getPartyName(party) {
  return party?.full_name ?? party?.name ?? party?.cardholder_name ?? party?.email ?? null
}

function avatarUserFromParty(party, fallbackName) {
  if (!party && !fallbackName) return null
  const name = fallbackName ?? getPartyName(party) ?? ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return {
    ...party,
    first_name: party?.first_name ?? parts[0],
    last_name: party?.last_name ?? parts.slice(1).join(' '),
    full_name: party?.full_name ?? name,
    name,
    avatar_url: party?.avatar_url,
  }
}

function isPartyCurrentUser(party, currentUserId) {
  return party?.user_id != null && currentUserId != null && Number(party.user_id) === Number(currentUserId)
}

function isCardOwned(cardId, ownedCardIds) {
  return cardId != null && ownedCardIds?.has(Number(cardId))
}

function isOutgoing(transaction, currentUserId, ownedCardIds) {
  if (Number(transaction?.transaction_type_id) === 1 || transaction?.sender_card_id == null) return false
  if (isPartyCurrentUser(transaction?.sender, currentUserId)) return true
  if (isPartyCurrentUser(transaction?.recipient, currentUserId)) return false
  if (isCardOwned(transaction?.sender_card_id, ownedCardIds)) return true
  if (isCardOwned(transaction?.recipient_card_id, ownedCardIds)) return false
  return [2, 4, 5].includes(Number(transaction?.transaction_type_id))
}

function getCounterparty(transaction, currentUserId, ownedCardIds) {
  if (Number(transaction?.transaction_type_id) === 1 || transaction?.sender_card_id == null) {
    return { name: 'External deposit', user: null }
  }

  const outgoing = isOutgoing(transaction, currentUserId, ownedCardIds)
  const party = outgoing ? transaction?.recipient : transaction?.sender
  const fallbackCardId = outgoing ? transaction?.recipient_card_id : transaction?.sender_card_id
  const name =
    getPartyName(party) ??
    transaction?.recipient_name ??
    transaction?.merchant_name ??
    transaction?.payee_name ??
    transaction?.description ??
    (fallbackCardId ? `Card #${fallbackCardId}` : null)
  const user = party ?? transaction?.counterparty ?? null
  return { name: name || '—', user }
}

function isAwaitingApproval(transaction) {
  return Boolean(
    transaction?.awaiting_user_approval ||
      (transaction?.requires_user_approval &&
        !transaction?.user_approved_at &&
        Number(transaction?.status_id) === 1),
  )
}

function isPending(transaction) {
  return Number(transaction?.status_id) === 1 || getStatusLabel(transaction).toLowerCase() === 'pending'
}

function isCompleted(transaction) {
  return Number(transaction?.status_id) === 2 || getStatusLabel(transaction).toLowerCase() === 'completed'
}

function isSentByCurrentUser(transaction, ownedCardIds, currentUserId) {
  return isOutgoing(transaction, currentUserId, ownedCardIds)
}

function isUserToUserTransaction(transaction) {
  return transaction?.sender_card_id != null && transaction?.recipient_card_id != null
}

function isPaymentTransaction(transaction) {
  return Number(transaction?.transaction_type_id) === 2
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-card-foreground">{children}</dd>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3 rounded-surface border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Loading full payment details…
    </div>
  )
}

function ErrorState({ error }) {
  return (
    <div className="flex items-start gap-3 rounded-surface border border-destructive/30 bg-destructive/5 p-4">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div>
        <p className="text-sm font-medium text-destructive">Could not load detail data</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {error?.message ?? 'The selected transaction is shown with the data currently available.'}
        </p>
      </div>
    </div>
  )
}

function MissingState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-surface border border-dashed border-border bg-muted/20 p-8 text-center">
      <ReceiptText className="size-7 text-muted-foreground" strokeWidth={1.5} />
      <p className="mt-3 font-medium text-card-foreground">No transaction selected</p>
      <p className="mt-1 text-sm text-muted-foreground">Select a transaction from history to view details.</p>
    </div>
  )
}

function HeaderCard({ transaction, currentUserId, ownedCardIds }) {
  const { formatMoney } = useDisplayCurrency()
  const outgoing = isOutgoing(transaction, currentUserId, ownedCardIds)
  const DirectionIcon = outgoing ? ArrowUpRight : ArrowDownLeft
  const counterparty = getCounterparty(transaction, currentUserId, ownedCardIds)
  const verb = outgoing ? 'Sending money to' : 'Received from'
  const subline = outgoing ? 'Sent' : 'Received'

  return (
    <div className="rounded-surface border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative shrink-0">
            {counterparty.user ? (
              <UserAvatar
                user={avatarUserFromParty(counterparty.user, counterparty.name)}
                className="size-10 text-xs ring-1 ring-border"
                textClassName="text-xs"
              />
            ) : (
              <span
                className={`flex size-10 items-center justify-center rounded-full ${
                  outgoing ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                }`}
              >
                <DirectionIcon className="size-5" />
              </span>
            )}
            {counterparty.user ? (
              <span
                className={`absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-card ${
                  outgoing ? 'bg-destructive text-destructive-foreground' : 'bg-success text-success-foreground'
                }`}
              >
                <DirectionIcon className="size-3" strokeWidth={2.4} />
              </span>
            ) : null}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm text-card-foreground">
              {verb}{' '}
              <span className="font-semibold">{counterparty.name}</span>
            </p>
            <p className="text-xs text-muted-foreground">{subline}</p>
          </div>
        </div>
        <p className="shrink-0 text-base font-bold text-card-foreground">
          {outgoing ? '-' : '+'} {formatMoney(transaction?.amount)}
        </p>
      </div>
    </div>
  )
}

function PartyCard({ label, party, name, email, lastFour }) {
  const avatarUser = avatarUserFromParty(party, name)
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      <UserAvatar
        user={avatarUser}
        className="size-11 text-sm ring-1 ring-primary/15"
        textClassName="text-sm"
      />
      <div>
        <p className="text-sm font-semibold text-card-foreground leading-tight">{name ?? '—'}</p>
        {email && <p className="mt-0.5 text-xs text-muted-foreground">{email}</p>}
        {lastFour && <p className="mt-0.5 text-xs text-muted-foreground">•••• {lastFour}</p>}
      </div>
      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
  )
}

function TransferFlow({ transaction }) {
  const { formatMoney } = useDisplayCurrency()
  const sender = transaction?.sender
  const recipient = transaction?.recipient
  if (!sender && !recipient) return null

  return (
    <div className="flex items-center gap-3 rounded-surface border border-border bg-muted/20 px-4 py-4">
      <PartyCard
        label="Sender"
        party={sender}
        name={sender?.full_name ?? sender?.cardholder_name}
        email={sender?.email}
        lastFour={sender?.last_four}
      />
      <div className="flex shrink-0 flex-col items-center gap-1">
        <MoveRight className="size-5 text-muted-foreground" />
        <span className="text-xs font-semibold text-card-foreground">{formatMoney(transaction?.amount)}</span>
      </div>
      <PartyCard
        label="Recipient"
        party={recipient}
        name={recipient?.full_name ?? recipient?.cardholder_name}
        email={recipient?.email}
        lastFour={recipient?.last_four}
      />
    </div>
  )
}

function DetailsSection({ transaction, currentUserId, ownedCardIds }) {
  const { formatMoney } = useDisplayCurrency()
  const outgoing = isOutgoing(transaction, currentUserId, ownedCardIds)
  const counterparty = getCounterparty(transaction, currentUserId, ownedCardIds)
  const statusMeta = getTransactionStatus(
    Number(transaction?.status_id),
    transaction?.has_pending_refund,
    isAwaitingApproval(transaction),
  )
  const statusLabel = statusMeta.label
  const statusVariant = statusMeta.variant

  return (
    <section>
      <h3 className="text-sm font-semibold text-card-foreground">Details</h3>
      <dl className="mt-2 divide-y divide-border/70">
        <DetailRow label="Transaction ID">{getTransactionId(transaction) ?? '—'}</DetailRow>
        <DetailRow label="Transaction Date">{formatDate(transaction?.created_at)}</DetailRow>
        <DetailRow label={outgoing ? 'Recipient' : 'Sender'}>
          <span className="inline-flex items-center gap-2">
            <UserAvatar
              user={avatarUserFromParty(counterparty.user, counterparty.name)}
              className="size-6 text-[10px]"
              textClassName="text-[10px]"
            />
            <span>{counterparty.name}</span>
          </span>
        </DetailRow>
        <DetailRow label="Status">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </DetailRow>
        <DetailRow label={outgoing ? 'Amount Sent' : 'Amount Received'}>
          {formatMoney(transaction?.amount)}
        </DetailRow>
        <DetailRow label="Fee">{formatMoney(transaction?.fee ?? 0)}</DetailRow>
        <DetailRow label="Type">{getTypeLabel(transaction)}</DetailRow>
      </dl>
    </section>
  )
}

const EVENT_LABELS = {
  created: 'Payment created — awaiting approval',
  approved: 'Approved by you',
  cancelled: 'Cancelled',
  timed_out: 'Approval window expired',
}

function ApprovalAuditSection({ transactionId, open }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !transactionId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    transactionsService
      .listApprovalEvents(transactionId)
      .then((rows) => {
        if (!cancelled) setEvents(rows ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Could not load approval history.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, transactionId])

  if (!open) return null
  if (loading) {
    return (
      <section className="rounded-surface border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
        Loading approval history…
      </section>
    )
  }
  if (error || events.length === 0) return null

  return (
    <section>
      <h3 className="text-sm font-semibold text-card-foreground">Approval history</h3>
      <ol className="mt-2 space-y-2">
        {events.map((event) => (
          <li
            key={event.event_id}
            className="rounded-surface border border-border bg-card px-3 py-2 text-xs"
          >
            <p className="font-medium text-card-foreground">
              {EVENT_LABELS[event.event_type] ?? event.event_type}
            </p>
            <p className="mt-0.5 text-muted-foreground">{formatDate(event.created_at)}</p>
            {event.verification_method && (
              <p className="mt-0.5 text-muted-foreground">
                Verified via {event.verification_method}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

// Owner can re-categorise (or clear) a transaction after the fact. Category is
// metadata: the PATCH carries only category_id and never touches status/balances.
// Optimistic update — the select reflects the choice immediately and rolls back
// if the API rejects it; emitDataChange refreshes the history list/pills.
function CategorySection({ transactionId, currentCategoryId }) {
  const categories = useAppSelector(selectTransactionCategories)
  const options = buildCategoryOptions(categories)
  const [value, setValue] = useState(
    currentCategoryId != null ? String(currentCategoryId) : '',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setValue(currentCategoryId != null ? String(currentCategoryId) : '')
  }, [currentCategoryId])

  if (!transactionId || options.length === 0) return null

  async function handleChange(nextValue) {
    const previous = value
    setValue(nextValue) // optimistic
    setError(null)
    setIsSaving(true)
    const categoryId = nextValue === '' ? null : Number(nextValue)
    try {
      await transactionsService.patch(transactionId, { category_id: categoryId })
      emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
    } catch (err) {
      setValue(previous) // rollback
      setError(err?.message ?? 'Could not update category.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-card-foreground">Category</h3>
        {isSaving ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
      </div>
      <Select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isSaving}
        options={[{ value: '', label: 'Uncategorised' }, ...options]}
        className="h-10 rounded-input border-border bg-card shadow-none"
      />
      {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
    </section>
  )
}

function NotesSection({ value, onChange, placeholder = 'Add a few notes to help you later' }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-card-foreground">Notes</h3>
        <Info className="size-3.5 text-muted-foreground" />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 500))}
        placeholder={placeholder}
        rows={4}
        maxLength={500}
        className="w-full resize-none rounded-input border border-border bg-card p-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
      />
    </section>
  )
}

function PanelBody({
  detail,
  hasApiDetail,
  isLoading,
  error,
  isClosing,
  onClose,
  onRefund,
  onCancel,
  _onShare,
  _onSaveNotes,
  ownedCardIds,
  currentUserId,
  refundRequestedTransactionIds,
  isCancelling,
  onApproved,
}) {
  const [notes, setNotes] = useState(detail?.note ?? detail?.notes ?? '')
  const [approvalOpen, setApprovalOpen] = useState(false)
  const animationClass = isClosing ? PANEL_EXIT_ANIMATION : PANEL_ENTER_ANIMATION
  const transactionId = getTransactionId(detail)
  const sentByCurrentUser = isSentByCurrentUser(detail, ownedCardIds, currentUserId)
  // Action buttons only render when a handler is wired — lets the panel be opened
  // read-only (e.g. from the wallet's per-card activity list).
  const canCancel = typeof onCancel === 'function' && isPending(detail) && sentByCurrentUser
  const canApprove =
    typeof onApproved === 'function' &&
    isAwaitingApproval(detail) &&
    sentByCurrentUser
  // A refund already exists for this transaction if the detail says so (any
  // status — pending/approved/declined/cancelled) or it was just requested in
  // this session. `refund_status` is authoritative when present; the optimistic
  // set and has_pending_refund both imply "pending".
  const existingRefundStatus =
    detail?.refund_status ??
    ((detail?.has_pending_refund || refundRequestedTransactionIds?.has(transactionId))
      ? 'pending'
      : null)
  const refundRequested = existingRefundStatus !== null
  const refundUi = existingRefundStatus ? REFUND_STATUS_UI[existingRefundStatus] : null
  const canRefund =
    typeof onRefund === 'function' &&
    isUserToUserTransaction(detail) &&
    isCompleted(detail) &&
    isPaymentTransaction(detail) &&
    sentByCurrentUser

  return (
    <aside
      className={`relative z-10 flex h-full w-full flex-col overflow-hidden rounded-none border border-border bg-card shadow-2xl will-change-transform sm:max-w-md sm:rounded-panel ${animationClass}`}
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-6 sm:py-4 sm:pt-4">
        <h2
          id="transaction-detail-title"
          className="text-base font-semibold text-card-foreground"
        >
          Transaction Details
        </h2>
        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label="Close"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition touch-manipulation hover:bg-muted hover:text-card-foreground sm:size-8"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
        {isLoading && <LoadingState />}
        {error && <ErrorState error={error} />}

        {detail && (
          <>
            <HeaderCard
              transaction={detail}
              currentUserId={currentUserId}
              ownedCardIds={ownedCardIds}
            />
            <TransferFlow transaction={detail} />

            {!hasApiDetail && (
              <div className="rounded-surface border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                Showing available history data until the detail API responds with the full record.
              </div>
            )}

            <DetailsSection
              transaction={detail}
              currentUserId={currentUserId}
              ownedCardIds={ownedCardIds}
            />
            {hasApiDetail && (
              <CategorySection
                transactionId={transactionId}
                currentCategoryId={detail?.category_id}
              />
            )}
            {detail?.requires_user_approval && (
              <ApprovalAuditSection transactionId={transactionId} open={hasApiDetail} />
            )}
            <NotesSection value={notes} onChange={setNotes} />
          </>
        )}
      </div>

      <footer className="grid grid-cols-2 gap-3 border-t border-border bg-card px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:pb-4">
        {canApprove && (
          <Button
            className="col-span-2 h-11 rounded-input px-4 text-sm font-semibold shadow-none"
            disabled={!detail}
            onClick={() => setApprovalOpen(true)}
          >
            <ShieldCheck className="mr-2 size-4" />
            Approve payment
          </Button>
        )}
        {canCancel && (
          <Button
            variant="destructive"
            className="col-span-2 h-11 rounded-input border-2 border-destructive/20 px-4 text-sm font-semibold shadow-none"
            disabled={!detail || isCancelling}
            onClick={() => onCancel?.(detail)}
          >
            {isCancelling ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Ban className="mr-2 size-4" />
            )}
            {isCancelling ? 'Cancelling…' : 'Cancel transaction'}
          </Button>
        )}
        {canRefund && (
          <>
            <Button
              variant="outline"
              className="col-span-2 h-11 rounded-input border-2 border-border bg-background/70 px-4 text-sm font-semibold shadow-none hover:bg-muted/70"
              disabled={!detail || refundRequested}
              onClick={() => onRefund?.(detail)}
            >
              <RotateCcw className="mr-2 size-4" />
              {refundUi ? refundUi.button : 'Request refund'}
            </Button>
            {refundUi && (
              <p className="col-span-2 -mt-1 text-center text-xs leading-5 text-muted-foreground">
                {refundUi.note}
              </p>
            )}
          </>
        )}
        <span title="Coming soon" className="contents">
          <Button
            variant="outline"
            className="h-11 rounded-input border-2 border-border bg-background/70 px-4 text-sm font-semibold shadow-none hover:bg-muted/70"
            disabled
          >
            <Share2 className="mr-2 size-4" />
            Share transaction
          </Button>
        </span>
        <span title="Coming soon" className="contents">
          <Button
            variant="outline"
            className="h-11 rounded-input border-2 border-border bg-background/70 px-4 text-sm font-semibold shadow-none hover:bg-muted/70"
            disabled
          >
            <Save className="mr-2 size-4" />
            Save notes
          </Button>
        </span>
      </footer>

      <PaymentApprovalModal
        isOpen={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        transaction={detail}
        onApproved={(updated) => {
          setApprovalOpen(false)
          onApproved?.(updated)
          emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
        }}
      />
    </aside>
  )
}

export default function TransactionDetailPanel({
  transaction,
  open = Boolean(transaction),
  onClose,
  onRefund,
  onCancel,
  onApproved,
  onShare,
  onSaveNotes,
  ownedCardIds,
  refundRequestedTransactionIds,
  isCancelling = false,
}) {
  const { detail, hasApiDetail, isLoading, error } = useTransactionDetail(open ? transaction : null)
  const { user } = useAuth()
  const currentUserId = user?.user_id ?? user?.id
  const [isClosing, setIsClosing] = useState(false)

  const requestClose = useCallback(() => {
    if (isClosing) return
    setIsClosing(true)
    window.setTimeout(() => {
      onClose?.()
      setIsClosing(false)
    }, CLOSE_ANIMATION_MS)
  }, [isClosing, onClose])

  useEffect(() => {
    if (!open) return undefined
    const handleKey = (e) => {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, requestClose])

  if (!open) return null

  const hasTransaction = Boolean(transaction)
  const panelKey = getTransactionId(transaction) ?? 'no-transaction'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="transaction-detail-title"
      className="fixed inset-0 z-50 flex justify-end p-0 sm:p-6"
    >
      <button
        type="button"
        aria-label="Close transaction details"
        onClick={requestClose}
        className={`absolute inset-0 bg-foreground/30 transition-opacity ${
          isClosing ? OVERLAY_EXIT_ANIMATION : OVERLAY_ENTER_ANIMATION
        }`}
      />

      {hasTransaction ? (
        <PanelBody
          key={panelKey}
          detail={detail}
          hasApiDetail={hasApiDetail}
          isLoading={isLoading}
          error={error}
          isClosing={isClosing}
          onClose={requestClose}
          onRefund={onRefund}
          onCancel={onCancel}
          onShare={onShare}
          onSaveNotes={onSaveNotes}
          ownedCardIds={ownedCardIds}
          currentUserId={currentUserId}
          refundRequestedTransactionIds={refundRequestedTransactionIds}
          isCancelling={isCancelling}
          onApproved={onApproved}
        />
      ) : (
        <aside
          className={`relative z-10 flex h-full w-full flex-col overflow-hidden rounded-none border border-border bg-card shadow-2xl will-change-transform sm:max-w-md sm:rounded-panel ${
            isClosing ? PANEL_EXIT_ANIMATION : PANEL_ENTER_ANIMATION
          }`}
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-6 sm:py-4 sm:pt-4">
            <h2
              id="transaction-detail-title"
              className="text-base font-semibold text-card-foreground"
            >
              Transaction Details
            </h2>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition touch-manipulation hover:bg-muted hover:text-card-foreground sm:size-8"
            >
              <X className="size-4" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <MissingState />
          </div>
        </aside>
      )}
    </div>
  )
}
