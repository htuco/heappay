import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const TYPE_LABEL = { 1: 'Deposit', 2: 'Payment', 3: 'Refund', 4: 'Withdrawal', 5: 'Chargeback' }
const TYPE_VARIANT = { 1: 'success', 2: 'default', 3: 'info', 4: 'warning', 5: 'error' }
const STATUS_LABEL = { 1: 'Pending', 2: 'Completed', 3: 'Failed', 4: 'Reversed' }
const STATUS_VARIANT = { 1: 'warning', 2: 'success', 3: 'error', 4: 'secondary' }

const TYPE_FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Deposits', value: '1' },
  { label: 'Payments', value: '2' },
  { label: 'Refunds', value: '3' },
  { label: 'Withdrawals', value: '4' },
]

function formatAmount(amount) {
  const num = parseFloat(amount ?? '0')
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TransactionHistoryPanel({
  transactions = [],
  typeFilter,
  onTypeFilterChange,
  selectedTransactionId,
  onSelectTransaction,
  onMakePayment,
  page,
  totalPages,
  onPageChange,
  isLoading,
  error,
}) {
  const filtered =
    typeFilter === 'all'
      ? transactions
      : transactions.filter((t) => String(t.transaction_type_id) === typeFilter)

  return (
    <article className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 xl:col-span-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Transactions</h2>
          <p className="text-xs text-muted-foreground">Your payment activity</p>
        </div>
        <Button variant="default" size="sm">
          Make Payment
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TYPE_FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={typeFilter === opt.value ? 'default' : 'outline'}
            onClick={() => onTypeFilterChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-background/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">Loading transactions…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-dashed border-destructive/40 bg-background/50 p-6 text-center">
          <p className="font-medium text-destructive">Failed to load transactions</p>
          <p className="mt-1 text-sm text-muted-foreground">{error?.message ?? 'An error occurred.'}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/50 p-6 text-center">
          <p className="font-medium text-card-foreground">No transactions found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different filter or make your first payment.
          </p>
          <Button className="mt-4" variant="outline">
            Clear filter
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
            <table className="w-full min-w-[560px] table-fixed text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">To Card</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((txn) => (
                  <tr
                    key={txn.transaction_id}
                    className={`cursor-pointer border-t border-border transition-colors ${
                      selectedTransactionId === txn.transaction_id
                        ? 'bg-primary/5'
                        : 'hover:bg-muted/40'
                    }`}
                    onClick={() => onSelectTransaction(txn)}
                  >
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(txn.created_at)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={TYPE_VARIANT[txn.transaction_type_id] ?? 'secondary'}>
                        {TYPE_LABEL[txn.transaction_type_id] ?? `Type ${txn.transaction_type_id}`}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">Card #{txn.recipient_card_id}</td>
                    <td className="px-4 py-3 font-medium text-card-foreground">
                      {formatAmount(txn.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[txn.status_id] ?? 'secondary'}>
                        {STATUS_LABEL[txn.status_id] ?? `Status ${txn.status_id}`}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((txn) => (
              <article
                key={txn.transaction_id}
                className={`cursor-pointer rounded-2xl border bg-background p-3 transition-colors ${
                  selectedTransactionId === txn.transaction_id
                    ? 'border-primary/40 ring-1 ring-primary/30'
                    : 'border-border'
                }`}
                onClick={() => onSelectTransaction(txn)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={TYPE_VARIANT[txn.transaction_type_id] ?? 'secondary'}>
                      {TYPE_LABEL[txn.transaction_type_id] ?? `Type ${txn.transaction_type_id}`}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[txn.status_id] ?? 'secondary'}>
                      {STATUS_LABEL[txn.status_id] ?? `Status ${txn.status_id}`}
                    </Badge>
                  </div>
                  <p className="font-medium text-card-foreground">{formatAmount(txn.amount)}</p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Card #{txn.recipient_card_id} · {formatDate(txn.created_at)}
                </p>
                {txn.note && (
                  <p className="mt-1 text-xs text-muted-foreground">{txn.note}</p>
                )}
              </article>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
            >
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} / {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (totalPages || 1)}
              onClick={() => onPageChange(Math.min(totalPages || 1, page + 1))}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </article>
  )
}
