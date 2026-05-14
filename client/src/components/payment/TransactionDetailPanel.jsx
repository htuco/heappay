import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  Info,
  Loader2,
  ReceiptText,
  RotateCcw,
  Save,
  Share2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import UserAvatar from '@/components/ui/UserAvatar'
import useTransactionDetail from '@/hooks/useTransactionDetail'

const TYPE_LABEL = { 1: 'Deposit', 2: 'Payment', 3: 'Refund', 4: 'Withdrawal', 5: 'Chargeback' }
const STATUS_LABEL = { 1: 'Pending', 2: 'Completed', 3: 'Failed', 4: 'Reversed' }
const STATUS_VARIANT = { 1: 'warning', 2: 'success', 3: 'error', 4: 'secondary' }
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

function formatAmount(amount) {
  const num = Number.parseFloat(amount ?? '0')
  if (Number.isNaN(num)) return '—'
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
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
    STATUS_LABEL[transaction?.status_id] ??
    'Unknown'
  )
}

function getCounterparty(transaction) {
  const name =
    transaction?.recipient?.name ??
    transaction?.recipient_name ??
    transaction?.merchant_name ??
    transaction?.payee_name ??
    transaction?.description ??
    (transaction?.recipient_card_id ? `Card #${transaction.recipient_card_id}` : null)
  const user = transaction?.recipient ?? transaction?.counterparty ?? null
  return { name: name || '—', user }
}

function isOutgoing(transaction) {
  return [2, 4, 5].includes(Number(transaction?.transaction_type_id))
}

function isPending(transaction) {
  return Number(transaction?.status_id) === 1 || getStatusLabel(transaction).toLowerCase() === 'pending'
}

function isCompleted(transaction) {
  return Number(transaction?.status_id) === 2 || getStatusLabel(transaction).toLowerCase() === 'completed'
}

function isSentByCurrentUser(transaction, ownedCardIds) {
  const senderCardId = Number(transaction?.sender_card_id)
  if (!senderCardId) return false
  if (ownedCardIds?.size) return ownedCardIds.has(senderCardId)
  return isOutgoing(transaction)
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
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Loading full payment details…
    </div>
  )
}

function ErrorState({ error }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
      <ReceiptText className="size-7 text-muted-foreground" strokeWidth={1.5} />
      <p className="mt-3 font-medium text-card-foreground">No transaction selected</p>
      <p className="mt-1 text-sm text-muted-foreground">Select a transaction from history to view details.</p>
    </div>
  )
}

function HeaderCard({ transaction }) {
  const outgoing = isOutgoing(transaction)
  const DirectionIcon = outgoing ? ArrowUpRight : ArrowDownLeft
  const counterparty = getCounterparty(transaction)
  const verb = outgoing ? 'Sending money to' : 'Received from'
  const subline = outgoing ? 'Sent' : 'Received'

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
              outgoing ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
            }`}
          >
            <DirectionIcon className="size-5" />
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
          {outgoing ? '-' : '+'} {formatAmount(transaction?.amount)}
        </p>
      </div>
    </div>
  )
}

function DetailsSection({ transaction }) {
  const counterparty = getCounterparty(transaction)
  const statusLabel = getStatusLabel(transaction)
  const statusVariant = STATUS_VARIANT[transaction?.status_id] ?? 'secondary'

  return (
    <section>
      <h3 className="text-sm font-semibold text-card-foreground">Details</h3>
      <dl className="mt-2 divide-y divide-border/70">
        <DetailRow label="Transaction ID">{getTransactionId(transaction) ?? '—'}</DetailRow>
        <DetailRow label="Transaction Date">{formatDate(transaction?.created_at)}</DetailRow>
        <DetailRow label="Recipient">
          <span className="inline-flex items-center gap-2">
            <UserAvatar
              user={counterparty.user}
              className="size-6 text-[10px]"
              textClassName="text-[10px]"
            />
            <span>{counterparty.name}</span>
          </span>
        </DetailRow>
        <DetailRow label="Status">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </DetailRow>
        <DetailRow label="Amount Sent">{formatAmount(transaction?.amount)}</DetailRow>
        <DetailRow label="Fee">{formatAmount(transaction?.fee ?? 0)}</DetailRow>
        <DetailRow label="Type">{getTypeLabel(transaction)}</DetailRow>
      </dl>
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
        className="w-full resize-none rounded-2xl border border-border bg-card p-3 text-sm text-card-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
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
  onShare,
  onSaveNotes,
  ownedCardIds,
  refundRequestedTransactionIds,
  isCancelling,
}) {
  const [notes, setNotes] = useState(detail?.note ?? detail?.notes ?? '')
  const animationClass = isClosing ? PANEL_EXIT_ANIMATION : PANEL_ENTER_ANIMATION
  const transactionId = getTransactionId(detail)
  const canCancel = isPending(detail) && isSentByCurrentUser(detail, ownedCardIds)
  const refundRequested = refundRequestedTransactionIds?.has(transactionId)
  const canRefund = isUserToUserTransaction(detail) && isCompleted(detail) && isPaymentTransaction(detail)

  return (
    <aside
      className={`relative z-10 flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl will-change-transform ${animationClass}`}
    >
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
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
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-card-foreground"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {isLoading && <LoadingState />}
        {error && <ErrorState error={error} />}

        {detail && (
          <>
            <HeaderCard transaction={detail} />

            {!hasApiDetail && (
              <div className="rounded-2xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                Showing available history data until the detail API responds with the full record.
              </div>
            )}

            <DetailsSection transaction={detail} />
            <NotesSection value={notes} onChange={setNotes} />
          </>
        )}
      </div>

      <footer className="grid grid-cols-2 gap-3 border-t border-border bg-card px-6 py-4">
        {canCancel && (
          <Button
            variant="destructive"
            className="col-span-2 h-11 rounded-lg border-2 border-destructive/20 px-4 text-sm font-semibold shadow-none"
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
              className="col-span-2 h-11 rounded-lg border-2 border-border bg-background/70 px-4 text-sm font-semibold shadow-none hover:bg-muted/70"
              disabled={!detail || refundRequested}
              onClick={() => onRefund?.(detail)}
            >
              <RotateCcw className="mr-2 size-4" />
              {refundRequested ? 'Refund requested' : 'Request refund'}
            </Button>
            {refundRequested && (
              <p className="col-span-2 -mt-1 text-center text-xs leading-5 text-muted-foreground">
                Refund request created. The review team will process it.
              </p>
            )}
          </>
        )}
        <Button
          variant="outline"
          className="h-11 rounded-lg border-2 border-border bg-background/70 px-4 text-sm font-semibold shadow-none hover:bg-muted/70"
          disabled={!detail}
          onClick={() => onShare?.(detail, { notes })}
        >
          <Share2 className="mr-2 size-4" />
          Share transaction
        </Button>
        <Button
          variant="outline"
          className="h-11 rounded-lg border-2 border-border bg-background/70 px-4 text-sm font-semibold shadow-none hover:bg-muted/70"
          disabled={!detail}
          onClick={() => onSaveNotes?.(detail, notes)}
        >
          <Save className="mr-2 size-4" />
          Save notes
        </Button>
      </footer>
    </aside>
  )
}

export default function TransactionDetailPanel({
  transaction,
  open = Boolean(transaction),
  onClose,
  onRefund,
  onCancel,
  onShare,
  onSaveNotes,
  ownedCardIds,
  refundRequestedTransactionIds,
  isCancelling = false,
}) {
  const { detail, hasApiDetail, isLoading, error } = useTransactionDetail(open ? transaction : null)
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
      className="fixed inset-0 z-50 flex justify-end p-4 sm:p-6"
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
          refundRequestedTransactionIds={refundRequestedTransactionIds}
          isCancelling={isCancelling}
        />
      ) : (
        <aside
          className={`relative z-10 flex h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl will-change-transform ${
            isClosing ? PANEL_EXIT_ANIMATION : PANEL_ENTER_ANIMATION
          }`}
        >
          <header className="flex items-center justify-between border-b border-border px-6 py-4">
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
              className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-card-foreground"
            >
              <X className="size-4" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <MissingState />
          </div>
        </aside>
      )}
    </div>
  )
}
