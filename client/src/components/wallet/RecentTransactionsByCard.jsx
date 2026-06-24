import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Receipt, RotateCw } from 'lucide-react'

import TransactionDetailPanel from '@/components/payment/TransactionDetailPanel'
import TransactionHistoryRow from '@/components/payment/TransactionHistoryRow'
import { Button } from '@/components/ui/button'
import { useTransactions } from '@/hooks/useTransactions'

// Fixed-height body so the panel never reflows between loading / empty / rows.
// Sized to comfortably hold `pageSize` rows; overflow scrolls instead of growing.
const BODY_HEIGHT = 'min-h-[19rem]'

function ActivitySkeleton({ rows = 4 }) {
  return (
    <div className="divide-y divide-border/40">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="size-8 shrink-0 animate-pulse rounded-input bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-muted/60" />
          </div>
          <div className="h-3 w-14 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
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
 * Per-card transaction activity for the Wallet page. Lists transactions where
 * the selected card is sender or recipient, newest first. Changing `cardId`
 * re-scopes the list (the hook resets to page 1). Rows open the shared
 * TransactionDetailPanel read-only (no cancel/refund wired here). The body keeps
 * a fixed height so it doesn't expand/collapse as data loads.
 */
export default function RecentTransactionsByCard({ cardId, pageSize = 6 }) {
  const numericCardId = cardId != null ? Number(cardId) : undefined
  const { transactions, total, isLoading, error, refresh } = useTransactions({
    cardId: numericCardId,
    pageSize,
  })
  const [selectedTransaction, setSelectedTransaction] = useState(null)

  const hasTransactions = transactions.length > 0

  return (
    <section className="rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-card-foreground sm:text-lg">
            Recent Card Activity
          </h2>
          {!isLoading && !error ? (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {total > 0
                ? `Showing ${transactions.length} of ${total} transaction${total !== 1 ? 's' : ''}`
                : 'No activity yet'}
            </p>
          ) : null}
        </div>
        <Link
          to="/payments"
          className="inline-flex shrink-0 items-center gap-1 rounded-input px-2 py-1 text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          View all
          <ArrowRight className="size-3.5" strokeWidth={2} />
        </Link>
      </div>

      <div className={`overflow-hidden rounded-input border border-border/80 bg-card ${BODY_HEIGHT} flex flex-col`}>
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-8 text-center">
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
          <div className="divide-y divide-border/40 overflow-y-auto">
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
