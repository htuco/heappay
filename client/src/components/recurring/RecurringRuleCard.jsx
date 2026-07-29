import { Ban, CalendarClock, Pencil, TriangleAlert } from 'lucide-react'

import CardBrandIcon from '@/components/ui/CardBrandIcon'
import UserAvatar from '@/components/ui/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DUE_SOON_DAYS,
  daysUntilDue,
  formatRecurringAmount,
  nextDueLabel,
  recipientName,
  relativeDueLabel,
  scheduleLabel,
} from '@/utils/recurringPayments.utils'

const STATUS_META = {
  active: { label: 'Active', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'error' },
}

function statusMeta(status) {
  if (STATUS_META[status]) return STATUS_META[status]
  const raw = String(status ?? 'unknown')
  return { label: raw.charAt(0).toUpperCase() + raw.slice(1), variant: 'outline' }
}

function railClass(rule) {
  if (rule.status !== 'active') return 'bg-muted-foreground/30'
  const days = daysUntilDue(rule.next_due_at)
  if (rule.last_run_failed || (days !== null && days < 0)) return 'bg-destructive'
  if (days !== null && days <= DUE_SOON_DAYS) return 'bg-warning'
  return 'bg-primary'
}

function cancelledOn(value) {
  if (!value) return 'Cancelled'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Cancelled'
  return `Cancelled ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export default function RecurringRuleCard({ rule, onEdit, onCancel }) {
  const status = statusMeta(rule.status)
  const isActive = rule.status === 'active'
  const days = daysUntilDue(rule.next_due_at)
  const isUrgent = isActive && (rule.last_run_failed || (days !== null && days <= DUE_SOON_DAYS))
  const schedule = scheduleLabel(rule)

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-card border border-border bg-card pl-5 pr-4 py-3.5 shadow-sm transition-shadow hover:shadow-md',
        !isActive && 'opacity-70',
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1.5', railClass(rule))} aria-hidden />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar user={rule.recipient} className="size-10 text-sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-card-foreground">{recipientName(rule)}</p>
            {rule.note && (
              <p className="truncate text-sm text-muted-foreground">{rule.note}</p>
            )}
          </div>
        </div>
        {isActive && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Edit recurring payment to ${recipientName(rule)}`}
              onClick={() => onEdit(rule)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive"
              aria-label={`Cancel recurring payment to ${recipientName(rule)}`}
              onClick={() => onCancel(rule)}
            >
              <Ban className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="tabular text-2xl font-bold tracking-tight text-card-foreground">
          {formatRecurringAmount(rule.amount)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant} size="sm">{status.label}</Badge>
          <Badge variant="secondary" size="sm">{schedule}</Badge>
        </div>
      </div>

      {rule.last_run_failed && (
        <p
          className="mt-2.5 flex items-start gap-1.5 rounded-input bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive"
          title={rule.last_run_error || undefined}
        >
          <TriangleAlert className="mt-px size-3.5 shrink-0" />
          <span className="truncate">{rule.last_run_error || 'The last run failed.'}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/60 pt-2.5">
        <p
          className={cn(
            'flex items-center gap-1.5 text-sm',
            isUrgent ? 'font-semibold text-foreground' : 'text-muted-foreground',
          )}
        >
          <CalendarClock className={cn('size-4 shrink-0', isUrgent && 'text-warning')} />
          {isActive ? (
            <>
              Next {nextDueLabel(rule.next_due_at)}
              {relativeDueLabel(rule.next_due_at) && (
                <span className="font-normal text-muted-foreground">
                  · {relativeDueLabel(rule.next_due_at)}
                </span>
              )}
            </>
          ) : (
            cancelledOn(rule.cancelled_at)
          )}
        </p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CardBrandIcon brand={rule.sender?.brand} width={30} />
          {rule.sender?.last_four ? `···· ${rule.sender.last_four}` : 'Card'}
        </p>
      </div>
    </div>
  )
}
