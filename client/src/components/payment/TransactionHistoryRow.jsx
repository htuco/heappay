import { ArrowLeftRight, CreditCard } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  formatTransactionAmount,
  formatTransactionDate,
  getTransactionStatus,
  getTransactionType,
} from '@/components/payment/transactionHistory.utils'

export default function TransactionHistoryRow({ transaction, onSelect }) {
  const status = getTransactionStatus(transaction.status_id)
  const type = getTransactionType(transaction.transaction_type_id)
  const isSelectable = typeof onSelect === 'function'

  return (
    <article
      role={isSelectable ? 'button' : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      onClick={isSelectable ? () => onSelect(transaction) : undefined}
      onKeyDown={
        isSelectable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(transaction)
              }
            }
          : undefined
      }
      className={`rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/40 ${
        isSelectable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50' : ''
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ArrowLeftRight className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-card-foreground">
                Transaction #{transaction.transaction_id}
              </h3>
              <Badge variant={status.variant} size="sm">
                {status.label}
              </Badge>
            </div>
            <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4">
              <span className="inline-flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" />
                Card {transaction.sender_card_id ?? 'External'} to Card{' '}
                {transaction.recipient_card_id}
              </span>
              <span>{formatTransactionDate(transaction.created_at)}</span>
              <span>{type}</span>
            </div>
            {transaction.note ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{transaction.note}</p>
            ) : null}
          </div>
        </div>

        <p className="shrink-0 text-left text-lg font-bold tabular-nums text-card-foreground sm:text-right">
          {formatTransactionAmount(transaction.amount)}
        </p>
      </div>
    </article>
  )
}
