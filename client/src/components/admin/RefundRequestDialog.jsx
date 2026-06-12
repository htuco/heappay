import { useState } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import transactionsService from '@/services/transactionsService'
import { useNotifications } from '@/context/NotificationContext'
import { CATEGORIES } from '@/context/notifications/categories'

function formatAmount(amount) {
  const num = Number.parseFloat(amount ?? '0')
  if (Number.isNaN(num)) return '—'
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function RefundRequestDialog({ request, open, onOpenChange, onResolved }) {
  const { notify } = useNotifications()
  const [isApproving, setIsApproving] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)
  const [error, setError] = useState(null)

  const tx = request?.refund_detail?.transaction_id
  const isBusy = isApproving || isDeclining

  const requesterLabel = request?.requester_name || `user #${request?.target_user_id ?? '?'}`

  async function handleApprove() {
    setIsApproving(true)
    setError(null)
    try {
      await transactionsService.approveRefund(request.request_id)
      notify({
        type: 'success',
        category: CATEGORIES.REFUND_APPROVED,
        message: `Refund #${request.request_id} approved for ${requesterLabel}.`,
        link: { route: '/support/tickets' },
      })
      onResolved?.('approved')
      onOpenChange?.(false)
    } catch (err) {
      setError(err?.message ?? 'Failed to approve refund.')
    } finally {
      setIsApproving(false)
    }
  }

  async function handleDecline() {
    setIsDeclining(true)
    setError(null)
    try {
      await transactionsService.declineRefund(request.request_id)
      notify({
        type: 'info',
        category: CATEGORIES.REFUND_DECLINED,
        message: `Refund #${request.request_id} declined for ${requesterLabel}.`,
        link: { route: '/support/tickets' },
      })
      onResolved?.('declined')
      onOpenChange?.(false)
    } catch (err) {
      setError(err?.message ?? 'Failed to decline refund.')
    } finally {
      setIsDeclining(false)
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-slate-950/35 backdrop-blur-[10px]"
        closeButtonClassName="size-8 p-0 opacity-60 hover:opacity-100 dark:hover:bg-white/10"
        className="max-w-[28rem] rounded-[20px] border border-border bg-popover p-0 shadow-[0_20px_60px_rgba(15,23,42,0.18)] dark:border-white/10"
      >
        <div className="p-6">
          <DialogHeader className="mb-4 gap-0 pr-8">
            <DialogTitle className="text-[1.1rem] font-semibold text-card-foreground">
              Refund Request #{request?.request_id ?? '—'}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Review the details and approve or decline.
            </DialogDescription>
          </DialogHeader>

          {/* Original transaction info */}
          <div className="rounded-[14px] border border-border bg-muted/30 px-4 py-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Transaction</span>
              <span className="text-sm font-semibold text-card-foreground">#{tx ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Amount</span>
              <span className="text-sm font-semibold text-card-foreground">
                {formatAmount(request?.refund_detail?.transaction_amount)}
              </span>
            </div>
            {request?.refund_detail?.sender_name && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">From</span>
                <span className="text-sm text-card-foreground">{request.refund_detail.sender_name}</span>
              </div>
            )}
            {request?.refund_detail?.recipient_name && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">To</span>
                <span className="text-sm text-card-foreground">{request.refund_detail.recipient_name}</span>
              </div>
            )}
            {request?.refund_detail?.transaction_note && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Note</span>
                <span className="text-sm text-card-foreground max-w-[60%] text-right">{request.refund_detail.transaction_note}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Requested by</span>
              <span className="text-sm text-card-foreground">
                {request?.requester_name ?? `User #${request?.requester_user_id}`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Submitted</span>
              <span className="text-sm text-card-foreground">{formatDate(request?.created_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Status</span>
              <Badge variant="warning">Pending</Badge>
            </div>
          </div>

          {/* Reason */}
          {request?.note && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Reason</p>
              <p className="rounded-input border border-border bg-muted/20 px-3.5 py-2.5 text-sm text-card-foreground">
                {request.note}
              </p>
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-destructive">{error}</p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-11 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5 hover:border-destructive/50 shadow-none"
              disabled={isBusy}
              onClick={handleDecline}
            >
              {isDeclining ? <Loader2 className="mr-2 size-4 animate-spin" /> : <XCircle className="mr-2 size-4" />}
              {isDeclining ? 'Declining…' : 'Decline'}
            </Button>
            <Button
              className="h-11 rounded-xl bg-primary text-primary-foreground shadow-none hover:bg-primary/90"
              disabled={isBusy}
              onClick={handleApprove}
            >
              {isApproving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}
              {isApproving ? 'Approving…' : 'Approve'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
