import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Repeat2,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import {
  formatTransactionAmount,
  formatTransactionDate,
  getTransactionStatus,
  getTransactionType,
} from '@/components/payment/transactionHistory.utils'
import { formatBrandLabel } from '@/utils/paymentCard.utils'

const DIRECTION_META = {
  incoming: {
    Icon: ArrowDownLeft,
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  outgoing: {
    Icon: ArrowUpRight,
    bg: 'bg-slate-100 dark:bg-slate-500/10',
    color: 'text-slate-500 dark:text-slate-400',
  },
}

const TYPE_EXCEPTION_META = {
  3: {
    Icon: RotateCcw,
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    color: 'text-blue-600 dark:text-blue-400',
  },
  4: {
    Icon: Landmark,
    bg: 'bg-orange-50 dark:bg-orange-500/10',
    color: 'text-orange-600 dark:text-orange-400',
  },
  5: {
    Icon: ShieldAlert,
    bg: 'bg-red-50 dark:bg-red-500/10',
    color: 'text-red-600 dark:text-red-400',
  },
}

// Status badge — pill style, consistent sizing, neutral palette
const STATUS_STYLE = {
  success:     'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  warning:     'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  error:       'bg-red-50 text-red-600 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
  secondary:   'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/20',
  destructive: 'bg-red-50 text-red-600 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
}

function StatusPill({ label, variant }) {
  const cls = STATUS_STYLE[variant] ?? STATUS_STYLE.secondary
  return (
    <span className={`inline-flex items-center rounded-chip px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset leading-none ${cls}`}>
      {label}
    </span>
  )
}

function isPartyCurrentUser(party, currentUserId) {
  return party?.user_id != null && currentUserId != null && Number(party.user_id) === Number(currentUserId)
}

function isOutgoingTransaction(transaction, currentUserId) {
  if (Number(transaction.transaction_type_id) === 1 || transaction.sender_card_id == null) return false
  if (isPartyCurrentUser(transaction.sender, currentUserId)) return true
  if (isPartyCurrentUser(transaction.recipient, currentUserId)) return false
  return [2, 4, 5].includes(Number(transaction.transaction_type_id))
}

function getDirectionMeta(transaction, currentUserId) {
  const exceptionMeta = TYPE_EXCEPTION_META[Number(transaction.transaction_type_id)]
  if (exceptionMeta) return exceptionMeta

  return isOutgoingTransaction(transaction, currentUserId)
    ? DIRECTION_META.outgoing
    : DIRECTION_META.incoming
}

function getCounterparty(transaction, currentUserId) {
  const { sender, recipient, sender_card_id, transaction_type_id } = transaction
  if (transaction_type_id === 1) return 'External deposit'
  const isOutgoing = isOutgoingTransaction(transaction, currentUserId)
  const party = isOutgoing ? recipient : sender
  return (
    party?.full_name ??
    party?.cardholder_name ??
    (isOutgoing
      ? `Card #${transaction.recipient_card_id}`
      : sender_card_id ? `Card #${sender_card_id}` : 'External')
  )
}

function formatPartyName(party) {
  return party?.full_name ?? party?.cardholder_name ?? party?.email ?? null
}

function formatPartyCard(party) {
  if (!party) return null
  const brand = party.brand ? formatBrandLabel(party.brand) : 'Card'
  return party.last_four ? `${brand} ${party.last_four}` : brand
}

function buildSubtitle(cardText, note) {
  return [cardText, note].filter(Boolean).join(' · ') || null
}

function getTransactionDisplay(transaction, currentUserId) {
  const isDeposit = transaction.transaction_type_id === 1
  const isOutgoing = isOutgoingTransaction(transaction, currentUserId)
  const counterparty = isOutgoing ? transaction.recipient : transaction.sender
  const currentUserParty = isOutgoing ? transaction.sender : transaction.recipient

  if (isDeposit) {
    const cardText = formatPartyCard(transaction.recipient)
    return {
      title: 'External deposit',
      directionLabel: null,
      subtitle: buildSubtitle(cardText ? `to ${cardText}` : null, transaction.note),
    }
  }

  const cardText = formatPartyCard(currentUserParty)
  return {
    title:
      formatPartyName(counterparty) ??
      getCounterparty(transaction, currentUserId),
    directionLabel: isOutgoing ? 'To' : 'From',
    subtitle: buildSubtitle(cardText ? `${isOutgoing ? 'from' : 'to'} ${cardText}` : null, transaction.note),
  }
}

export default function TransactionHistoryRow({ transaction, onSelect }) {
  const { user } = useAuth()
  const currentUserId = user?.user_id ?? user?.id

  const status = getTransactionStatus(transaction.status_id, transaction.has_pending_refund)
  const type = getTransactionType(transaction.transaction_type_id)
  const { Icon, bg, color } = getDirectionMeta(transaction, currentUserId)

  const display = getTransactionDisplay(transaction, currentUserId)

  const isSelectable = typeof onSelect === 'function'

  return (
    <div
      role={isSelectable ? 'button' : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      onClick={isSelectable ? () => onSelect(transaction) : undefined}
      onKeyDown={
        isSelectable
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(transaction) } }
          : undefined
      }
      className={`group px-4 py-2.5 transition-colors ${isSelectable ? 'cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30' : ''}`}
    >
      {/* ── Mobile ── */}
      <div className="flex items-center gap-3 sm:hidden">
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-input ${bg} ${color}`}>
          <Icon className="size-3.5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {display.directionLabel ? (
                <span className="font-normal text-muted-foreground">{display.directionLabel} </span>
              ) : null}
              {display.title}
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {formatTransactionAmount(transaction.amount)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <StatusPill label={status.label} variant={status.variant} />
            {transaction.recurring_payment_id != null && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <Repeat2 className="size-3" />
                Recurring
              </span>
            )}
            <span className="text-xs text-muted-foreground">{formatTransactionDate(transaction.created_at)}</span>
          </div>
          {display.subtitle ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{display.subtitle}</p>
          ) : null}
        </div>
      </div>

      {/* ── Desktop — grid mirrors header: [28px | 1fr | 96px | 88px | 148px | 100px] ── */}
      <div className="hidden sm:grid sm:grid-cols-[28px_1fr_96px_88px_148px_100px] sm:items-center sm:gap-x-4">
        {/* Icon */}
        <div className={`flex size-7 items-center justify-center rounded-input ${bg} ${color}`}>
          <Icon className="size-3.5" strokeWidth={2} />
        </div>

        {/* Counterparty + description */}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {display.directionLabel ? (
              <span className="font-normal text-muted-foreground">{display.directionLabel} </span>
            ) : null}
            {display.title}
          </p>
          {display.subtitle ? (
            <p className="truncate text-xs text-muted-foreground/60">{display.subtitle}</p>
          ) : null}
        </div>

        {/* Type */}
        <div className="flex flex-col gap-0.5">
          <span className="truncate text-xs text-muted-foreground">{type}</span>
          {transaction.recurring_payment_id != null && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground/70">
              <Repeat2 className="size-3 shrink-0" />
              Recurring
            </span>
          )}
        </div>

        {/* Status */}
        <div>
          <StatusPill label={status.label} variant={status.variant} />
        </div>

        {/* Date */}
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatTransactionDate(transaction.created_at)}
        </span>

        {/* Amount */}
        <span className="text-right text-sm font-semibold tabular-nums text-foreground">
          {formatTransactionAmount(transaction.amount)}
        </span>
      </div>
    </div>
  )
}
