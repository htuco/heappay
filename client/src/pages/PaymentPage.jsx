import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AlertTriangle, Loader2, MessageSquareText } from 'lucide-react'

import TransactionDetailPanel from '@/components/payment/TransactionDetailPanel'
import TransactionHistory from '@/components/payment/TransactionHistory'
import { Button } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import transactionsService from '@/services/transactionsService'
import { useNotifications } from '@/context/NotificationContext'
import { CATEGORIES } from '@/context/notifications/categories'

const REFUND_REASONS = [
  'Duplicate payment',
  'Wrong recipient',
  'Incorrect amount',
  'Service or item was not delivered',
  'Other',
]
const REFUND_REASON_OPTIONS = REFUND_REASONS.map((reason) => ({
  value: reason,
  label: reason,
}))

// Status-aware copy when a refund already exists for the transaction being
// viewed in the refund modal. `null` status (optimistic, this-session) falls
// back to the pending message.
const REFUND_EXISTS_MESSAGE = {
  pending: 'A refund request for this transaction is already pending review.',
  approved: 'This transaction has already been refunded.',
  declined: 'A refund for this transaction was declined. That decision is final.',
  cancelled: 'A previous refund request for this transaction was cancelled.',
}

function getTransactionId(transaction) {
  return transaction?.transaction_id ?? transaction?.id ?? null
}

export default function PaymentPage() {
  const { notify } = useNotifications()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [transactionToCancel, setTransactionToCancel] = useState(null)
  const [transactionToRefund, setTransactionToRefund] = useState(null)
  const [cancelConfirmationId, setCancelConfirmationId] = useState('')
  const [refundReason, setRefundReason] = useState(REFUND_REASONS[0])
  const [refundOtherReason, setRefundOtherReason] = useState('')
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false)
  const [refundError, setRefundError] = useState(null)
  const [refundedTransactionIds, setRefundedTransactionIds] = useState(new Set())
  const cancelTransactionId = getTransactionId(transactionToCancel)
  const refundTransactionId = getTransactionId(transactionToRefund)
  const isCancelConfirmed =
    Boolean(cancelTransactionId) && cancelConfirmationId.trim() === String(cancelTransactionId)
  const resolvedRefundReason = refundReason === 'Other' ? refundOtherReason.trim() : refundReason
  // A refund already exists for this transaction if the detail carries a
  // refund_status (any state — a transaction can only ever have one refund) or
  // it was just optimistically requested this session.
  const existingRefundStatus = transactionToRefund?.refund_status ?? null
  const refundAlreadyExists =
    refundTransactionId !== null &&
    (existingRefundStatus !== null || refundedTransactionIds.has(refundTransactionId))
  // Kept name for the existing JSX/message below; now covers every "already
  // exists" case, not just pending.
  const refundAlreadyPending = refundAlreadyExists
  const canSubmitRefundRequest = Boolean(refundTransactionId) && Boolean(resolvedRefundReason) && !isSubmittingRefund && !refundAlreadyExists

  // Open the detail panel when the URL carries ?tx=<id> (e.g. from a
  // notification deep-link). useTransactionDetail will fetch the full record.
  useEffect(() => {
    const txParam = searchParams.get('tx')
    if (!txParam) return
    const id = Number.parseInt(txParam, 10)
    if (!Number.isFinite(id)) return
    setSelectedTransaction((current) => {
      if (getTransactionId(current) === id) return current
      return { transaction_id: id }
    })
  }, [searchParams])

  function closeSelectedTransaction() {
    setSelectedTransaction(null)
    if (searchParams.has('tx')) {
      const next = new URLSearchParams(searchParams)
      next.delete('tx')
      setSearchParams(next, { replace: true })
    }
  }

  function closeCancelPreview() {
    setTransactionToCancel(null)
    setCancelConfirmationId('')
  }

  function closeRefundPreview() {
    setTransactionToRefund(null)
    setRefundReason(REFUND_REASONS[0])
    setRefundOtherReason('')
    setRefundError(null)
  }

  async function handleSubmitRefund() {
    if (!canSubmitRefundRequest) return
    setIsSubmittingRefund(true)
    setRefundError(null)
    try {
      await transactionsService.requestRefund(refundTransactionId, resolvedRefundReason)
      setRefundedTransactionIds((prev) => new Set(prev).add(refundTransactionId))
      notify({
        type: 'success',
        category: CATEGORIES.REFUND_REQUESTED,
        message: 'Refund request submitted. We’ll notify you when it’s reviewed.',
        link: { route: '/payments', modal: { kind: 'transaction', id: refundTransactionId } },
      })
      closeRefundPreview()
    } catch (err) {
      setRefundError(err?.message ?? 'Failed to submit refund request.')
    } finally {
      setIsSubmittingRefund(false)
    }
  }

  return (
    <div>
      <TransactionHistory onTransactionSelect={setSelectedTransaction} />
      <TransactionDetailPanel
        open={Boolean(selectedTransaction)}
        transaction={selectedTransaction}
        onClose={closeSelectedTransaction}
        onCancel={setTransactionToCancel}
        onRefund={setTransactionToRefund}
        refundRequestedTransactionIds={refundedTransactionIds}
      />
      <DialogRoot
        open={Boolean(transactionToCancel)}
        onOpenChange={(open) => {
          if (!open) closeCancelPreview()
        }}
      >
        <DialogContent
          className="max-w-[27rem] rounded-panel border border-slate-200/80 bg-popover p-0 shadow-[0_20px_60px_rgba(15,23,42,0.18)] dark:border-white/10 dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] [&>button]:right-5 [&>button]:top-5 [&>button]:flex [&>button]:size-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:p-0 [&>button]:opacity-60 [&>button]:hover:bg-slate-100 [&>button]:hover:opacity-100 dark:[&>button]:hover:bg-white/10"
        >
          <div className="p-6 sm:p-7">
            <DialogHeader className="mb-0 gap-0 pr-8">
              <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-8 ring-amber-100/50 dark:bg-amber-400/15 dark:text-amber-300 dark:ring-amber-400/10">
                <AlertTriangle className="size-5" />
              </span>
              <DialogTitle className="text-[1.35rem] font-semibold leading-7 tracking-normal text-card-foreground">
                Cancel payment?
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-[22rem] text-sm leading-6 text-slate-600 dark:text-slate-300">
                The pending amount will be released back to your available balance.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-[18px] rounded-surface border border-slate-200/80 bg-slate-50 px-4 py-3.5 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-card-foreground">
                  Transaction #{cancelTransactionId ?? '—'}
                </p>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium leading-none text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  Pending payment
                </span>
              </div>
            </div>

            <div className="mt-[22px]">
              <label htmlFor="cancel-transaction-id" className="text-sm font-medium text-card-foreground">
                Type transaction ID to confirm
              </label>
              <Input
                id="cancel-transaction-id"
                inputMode="numeric"
                value={cancelConfirmationId}
                onChange={(event) => setCancelConfirmationId(event.target.value)}
                placeholder={cancelTransactionId ? String(cancelTransactionId) : 'Transaction ID'}
                className="mt-2.5 h-11 rounded-input border border-slate-200 bg-background px-3.5 font-semibold tabular-nums shadow-none focus-visible:border-blue-400 focus-visible:ring-[3px] focus-visible:ring-blue-500/10 dark:border-white/10"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Enter <span className="font-semibold text-card-foreground">{cancelTransactionId ?? 'the ID'}</span> to enable cancellation.
              </p>
            </div>

            <DialogFooter className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DialogClose asChild>
                <Button
                  className="h-11 rounded-input bg-slate-950 px-4 font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-950/20 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                >
                  Keep payment
                </Button>
              </DialogClose>
              <Button
                variant="outline"
                className="h-11 rounded-input border-red-200 bg-white px-4 font-semibold text-red-600 shadow-none hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus-visible:border-red-300 focus-visible:ring-red-500/15 disabled:border-red-100 disabled:bg-red-50/40 disabled:text-red-300 dark:border-red-400/30 dark:bg-transparent dark:text-red-300 dark:hover:border-red-400/50 dark:hover:bg-red-400/10"
                disabled={!isCancelConfirmed}
                onClick={closeCancelPreview}
              >
                Cancel payment
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </DialogRoot>
      <DialogRoot
        open={Boolean(transactionToRefund)}
        onOpenChange={(open) => {
          if (!open) closeRefundPreview()
        }}
      >
        <DialogContent
          className="max-w-[30rem] rounded-panel border border-slate-200/80 bg-popover p-0 shadow-[0_20px_60px_rgba(15,23,42,0.18)] dark:border-white/10 dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] [&>button]:right-5 [&>button]:top-5 [&>button]:flex [&>button]:size-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:p-0 [&>button]:opacity-60 [&>button]:hover:bg-slate-100 [&>button]:hover:opacity-100 dark:[&>button]:hover:bg-white/10"
        >
          <div className="p-6 sm:p-7">
            <DialogHeader className="mb-0 gap-0 pr-8">
              <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 ring-8 ring-blue-100/50 dark:bg-blue-400/15 dark:text-blue-300 dark:ring-blue-400/10">
                <MessageSquareText className="size-5" />
              </span>
              <DialogTitle className="text-[1.35rem] font-semibold leading-7 tracking-normal text-card-foreground">
                Request refund
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-[24rem] text-sm leading-6 text-slate-600 dark:text-slate-300">
                The other user will be notified. Our system will review the refund request, and the final decision depends on our employees.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-[18px] rounded-surface border border-slate-200/80 bg-slate-50 px-4 py-3.5 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-card-foreground">
                  Transaction #{refundTransactionId ?? '—'}
                </p>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium leading-none text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  Completed payment
                </span>
              </div>
            </div>

            <div className="mt-[22px]">
              <label htmlFor="refund-reason" className="text-sm font-medium text-card-foreground">
                Refund reason
              </label>
              <Select
                id="refund-reason"
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                options={REFUND_REASON_OPTIONS}
                className="mt-2.5 h-11 rounded-input border border-slate-200 bg-background px-3.5 shadow-none focus-visible:border-blue-400 focus-visible:ring-[3px] focus-visible:ring-blue-500/10 dark:border-white/10"
              />
            </div>

            {refundReason === 'Other' && (
              <div className="mt-4">
                <label htmlFor="refund-other-reason" className="text-sm font-medium text-card-foreground">
                  Describe refund status
                </label>
                <textarea
                  id="refund-other-reason"
                  value={refundOtherReason}
                  onChange={(event) => setRefundOtherReason(event.target.value.slice(0, 180))}
                  placeholder="Tell us why this payment should be refunded."
                  rows={4}
                  className="mt-2.5 w-full resize-none rounded-input border border-slate-200 bg-background px-3.5 py-3 text-sm font-medium text-card-foreground shadow-none outline-none transition focus-visible:border-blue-400 focus-visible:ring-[3px] focus-visible:ring-blue-500/10 disabled:pointer-events-none disabled:opacity-50 dark:border-white/10"
                />
              </div>
            )}

            <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Your reason will be added to the transaction notes and used by the review team.
            </p>

            {(refundAlreadyPending || refundError) && (
              <p
                className={`mt-4 text-xs leading-5 ${
                  refundError
                    ? 'text-destructive'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
                role="alert"
              >
                {refundError ??
                  REFUND_EXISTS_MESSAGE[existingRefundStatus] ??
                  REFUND_EXISTS_MESSAGE.pending}
              </p>
            )}

            <DialogFooter className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DialogClose asChild>
                <Button
                  variant="outline"
                  className="h-11 rounded-input border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-none hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
                >
                  Keep payment
                </Button>
              </DialogClose>
              <Button
                className="h-11 rounded-input bg-slate-950 px-4 font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-950/20 disabled:bg-slate-200 disabled:text-slate-400 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                disabled={!canSubmitRefundRequest}
                onClick={handleSubmitRefund}
              >
                {isSubmittingRefund ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                {isSubmittingRefund ? 'Submitting…' : 'Submit request'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  )
}
