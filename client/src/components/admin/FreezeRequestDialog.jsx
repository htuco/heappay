import { useState } from 'react'
import { CheckCircle2, Loader2, Snowflake, XCircle } from 'lucide-react'
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
import { REQUEST_STATUS_IDS, REQUEST_STATUS_META } from '@/utils/requestStatus'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function FreezeRequestDialog({ request, open, onOpenChange, onResolved }) {
  const { notify } = useNotifications()
  const [isApproving, setIsApproving] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)
  const [error, setError] = useState(null)

  const detail = request?.card_freeze_detail
  const isBusy = isApproving || isDeclining
  const isPending = request?.request_status_id === REQUEST_STATUS_IDS.pending
  const isUnfreeze = request?.request_type_name === 'card_unfreeze'
  const kind = isUnfreeze ? 'Unfreeze' : 'Freeze'
  const statusMeta =
    REQUEST_STATUS_META[request?.request_status_id] ?? REQUEST_STATUS_META[REQUEST_STATUS_IDS.pending]
  const requesterLabel = request?.requester_name || `user #${request?.requester_user_id ?? '?'}`

  async function handleApprove() {
    setIsApproving(true)
    setError(null)
    try {
      if (isUnfreeze) {
        await transactionsService.approveCardUnfreeze(request.request_id)
      } else {
        await transactionsService.approveCardFreeze(request.request_id)
      }
      notify({
        type: 'success',
        category: CATEGORIES.ADMIN_ACTION,
        message: `${kind} #${request.request_id} approved for ${requesterLabel}.`,
        link: { route: '/admin/requests' },
      })
      onResolved?.('approved')
      onOpenChange?.(false)
    } catch (err) {
      setError(err?.message ?? `Failed to approve ${kind.toLowerCase()} request.`)
    } finally {
      setIsApproving(false)
    }
  }

  async function handleDecline() {
    setIsDeclining(true)
    setError(null)
    try {
      if (isUnfreeze) {
        await transactionsService.declineCardUnfreeze(request.request_id)
      } else {
        await transactionsService.declineCardFreeze(request.request_id)
      }
      notify({
        type: 'info',
        category: CATEGORIES.ADMIN_ACTION,
        message: `${kind} #${request.request_id} declined for ${requesterLabel}.`,
        link: { route: '/admin/requests' },
      })
      onResolved?.('declined')
      onOpenChange?.(false)
    } catch (err) {
      setError(err?.message ?? `Failed to decline ${kind.toLowerCase()} request.`)
    } finally {
      setIsDeclining(false)
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-slate-950/35 backdrop-blur-[10px]"
        closeButtonClassName="size-11 md:size-8 p-0 opacity-60 hover:opacity-100 dark:hover:bg-white/10"
        className="max-w-[28rem] rounded-panel border border-border bg-popover p-0 shadow-[0_20px_60px_rgba(15,23,42,0.18)] dark:border-white/10"
      >
        <div className="p-6">
          <DialogHeader className="mb-4 gap-0 pr-8">
            <DialogTitle className="text-[1.1rem] font-semibold text-card-foreground">
              {kind} Request #{request?.request_id ?? '—'}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              {isPending
                ? isUnfreeze
                  ? 'Approving reactivates the card. Review and decide.'
                  : 'Approving freezes the card. Review and decide.'
                : 'This request has already been resolved.'}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-surface border border-border bg-muted/30 px-4 py-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Card</span>
              <span className="text-sm font-semibold text-card-foreground">
                •••• {detail?.card_last_four ?? '—'}
              </span>
            </div>
            {detail?.cardholder_name && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Cardholder</span>
                <span className="text-sm text-card-foreground">{detail.cardholder_name}</span>
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
            {request?.resolved_at && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Resolved</span>
                <span className="text-sm text-card-foreground">{formatDate(request.resolved_at)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Status</span>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            </div>
          </div>

          {request?.note && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Reason</p>
              <p className="rounded-input border border-border bg-muted/20 px-3.5 py-2.5 text-sm text-card-foreground">
                {request.note}
              </p>
            </div>
          )}

          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

          {isPending && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-11 rounded-input border-destructive/30 text-destructive hover:bg-destructive/5 hover:border-destructive/50 shadow-none"
                disabled={isBusy}
                onClick={handleDecline}
              >
                {isDeclining ? <Loader2 className="mr-2 size-4 animate-spin" /> : <XCircle className="mr-2 size-4" />}
                {isDeclining ? 'Declining…' : 'Decline'}
              </Button>
              <Button
                className="h-11 rounded-input bg-primary text-primary-foreground shadow-none hover:bg-primary/90"
                disabled={isBusy}
                onClick={handleApprove}
              >
                {isApproving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Snowflake className="mr-2 size-4" />}
                {isApproving ? 'Working…' : isUnfreeze ? 'Approve & unfreeze' : 'Approve & freeze'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
