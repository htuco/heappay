import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Receipt, RotateCw } from 'lucide-react'

import TransactionDetailPanel from '@/components/payment/TransactionDetailPanel'
import TransactionHistoryRow from '@/components/payment/TransactionHistoryRow'
import { Button } from '@/components/ui/button'
import CardBrandIcon from '@/components/ui/CardBrandIcon'
import Skeleton from '@/components/ui/skeleton'
import { useTransactions } from '@/hooks/useTransactions'
import { formatBrandLabel } from '@/utils/paymentCard.utils'

function ActivitySkeleton({ rows = 6 }) {
  return (
    <div className="divide-y divide-border/40">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="size-7 shrink-0 animate-pulse rounded-input bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-muted/60" />
          </div>
          <div className="h-3 w-14 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

/**
 * Standalone loading shell for the activity panel, used by WalletPage before any
 * card has resolved (so there's no cardId to mount the real table against). It
 * reproduces the loaded panel's chrome — header row, column header, body — at the
 * same dimensions so the page reserves this box up front and doesn't shift when
 * the real table takes over.
 */
export function WalletTransactionsTableSkeleton({ rows = 8 }) {
  return (
    <section className="@container/tbl flex h-full w-full flex-col rounded-panel border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-input" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="hidden border-y border-border/60 bg-muted/30 px-4 py-2 @[560px]/tbl:grid @[560px]/tbl:grid-cols-[28px_1fr_84px_120px_84px_128px_92px] @[560px]/tbl:items-center @[560px]/tbl:gap-x-4">
        <span />
        {['Description', 'Type', 'Category', 'Status', 'Date', 'Amount'].map((label) => (
          <span
            key={label}
            className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground last:text-right"
          >
            {label}
          </span>
        ))}
      </div>
      <div className="flex-1">
        <ActivitySkeleton rows={rows} />
      </div>
    </section>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Receipt className="size-5" strokeWidth={1.8} />
      </span>
      <p className="text-sm font-medium text-card-foreground">No transactions for this card yet</p>
      <p className="text-xs text-muted-foreground">
        Payments and transfers on this card will show up here.
      </p>
    </div>
  )
}

/**
 * Compact, statement-style transaction table for the active card. Reuses
 * TransactionHistoryRow but drops the boxed-card chrome in favour of a clean
 * bordered panel with a column header — a quieter, more professional read.
 */
export default function WalletTransactionsTable({ cardId, card, pageSize = 8 }) {
  const numericCardId = cardId != null ? Number(cardId) : undefined
  const { transactions, total, isLoading, error, refresh } = useTransactions({
    cardId: numericCardId,
    pageSize,
  })
  const [selectedTransaction, setSelectedTransaction] = useState(null)

  const hasTransactions = transactions.length > 0

  const brandLabel = formatBrandLabel(card?.brand) || 'Card'
  const lastFour = card?.lastFour ?? card?.last_four ?? null

  return (
    // @container/tbl: rows switch to the multi-column grid based on the table's
    // OWN width, not the viewport — so a 60%-width column never crushes the
    // description column the way a viewport breakpoint would.
    <section className="@container/tbl flex h-full w-full flex-col rounded-panel border border-border bg-card shadow-sm">
      {/* Header — leads with the card so it's obvious WHICH card's activity this is.
          The brand logo + masked number carry identity; the full brand word is
          dropped on small screens so the title never truncates mid-word. */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 items-center" aria-hidden>
            <CardBrandIcon brand={card?.brand} cardNumber={card?.cardNumber} width={40} format="flat" />
          </span>
          <div className="min-w-0">
            <h2 className="flex items-baseline gap-1.5 text-base font-semibold text-card-foreground sm:text-lg">
              <span>Activity</span>
              {lastFour ? (
                <span className="truncate text-muted-foreground">
                  <span className="hidden sm:inline">· {brandLabel} </span>
                  <span className="sm:hidden">· </span>
                  •••• {lastFour}
                </span>
              ) : null}
            </h2>
            {!isLoading && !error ? (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {total > 0
                  ? `Showing ${transactions.length} of ${total} transaction${total !== 1 ? 's' : ''} on this card`
                  : 'No activity on this card yet'}
              </p>
            ) : null}
          </div>
        </div>
        <Link
          to="/payments"
          className="inline-flex shrink-0 items-center gap-1 rounded-input px-2 py-1 text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          View all
          <ArrowRight className="size-3.5" strokeWidth={2} />
        </Link>
      </div>

      {/* Column header — mirrors TransactionHistoryRow desktop grid */}
      {hasTransactions && !error ? (
        <div className="hidden border-y border-border/60 bg-muted/30 px-4 py-2 @[560px]/tbl:grid @[560px]/tbl:grid-cols-[28px_1fr_84px_120px_84px_128px_92px] @[560px]/tbl:items-center @[560px]/tbl:gap-x-4">
          <span />
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Description
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Type
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Category
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Status
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Date
          </span>
          <span className="text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Amount
          </span>
        </div>
      ) : null}

      {/* Body — flex-1 stretches the panel to the column's full height; the rows
          sit at the top and the leftover space (when there are few transactions)
          stays as empty panel rather than collapsing the box. */}
      <div className="flex flex-1 flex-col">
        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <p className="text-sm text-destructive">
              Could not load this card&apos;s transactions.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={refresh}>
              <RotateCw className="size-3.5" strokeWidth={2} />
              Try again
            </Button>
          </div>
        ) : isLoading ? (
          <ActivitySkeleton rows={pageSize} />
        ) : !hasTransactions ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-border/40">
            {transactions.map((transaction) => (
              <TransactionHistoryRow
                key={transaction.transaction_id}
                transaction={transaction}
                onSelect={setSelectedTransaction}
              />
            ))}
          </div>
        )}
      </div>

      <TransactionDetailPanel
        open={Boolean(selectedTransaction)}
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </section>
  )
}
