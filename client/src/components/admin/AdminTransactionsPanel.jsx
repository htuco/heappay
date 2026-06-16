import { useCallback, useEffect, useState } from 'react'
import { ArrowLeftRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import transactionsService from '@/services/transactionsService'
import {
  TRANSACTION_STATUS_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  formatTransactionAmount,
  formatTransactionDate,
  getTransactionStatus,
  getTransactionType,
} from '@/components/payment/transactionHistory.utils'

const PAGE_SIZE = 20

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount_desc', label: 'Highest amount' },
  { value: 'amount_asc', label: 'Lowest amount' },
]

const STATUS_CHIP = {
  warning: 'border-warning/30 bg-warning/10 text-warning',
  success: 'border-success/30 bg-success/10 text-success',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  secondary: 'border-border bg-muted/40 text-muted-foreground',
}

function PartyCell({ party }) {
  if (!party) {
    return <span className="text-xs italic text-muted-foreground">External</span>
  }
  return (
    <span className="flex flex-col leading-tight">
      <span className="max-w-[140px] truncate text-xs font-medium text-card-foreground">
        {party.full_name ?? party.email ?? '—'}
      </span>
      {party.last_four && (
        <span className="text-[11px] text-muted-foreground">···· {party.last_four}</span>
      )}
    </span>
  )
}

export default function AdminTransactionsPanel() {
  const [transactions, setTransactions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('newest')
  const [statusId, setStatusId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback(async (p, currentSort, currentStatusId, currentTypeId) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = { page: p, pageSize: PAGE_SIZE, sort: currentSort }
      if (currentStatusId) params.statusId = Number(currentStatusId)
      if (currentTypeId) params.transactionTypeId = Number(currentTypeId)
      const result = await transactionsService.listAll(params)
      setTransactions(result.items ?? [])
      setTotal(result.total ?? 0)
      setPage(p)
    } catch {
      setError('Failed to load transactions.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load(1, sort, statusId, typeId)
  }, [load, sort, statusId, typeId])

  return (
    <article className="rounded-panel border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-input bg-primary/10 text-primary">
            <ArrowLeftRight className="size-4" strokeWidth={2} />
          </span>
          <h2 className="truncate text-base font-semibold text-card-foreground">All Transactions</h2>
          {!isLoading && total > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {total.toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={statusId}
            onChange={(e) => setStatusId(e.target.value)}
            options={[{ value: '', label: 'All statuses' }, ...TRANSACTION_STATUS_OPTIONS]}
            className="h-8 w-auto rounded-input border-border bg-background py-0 text-xs shadow-none"
          />
          <Select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            options={[{ value: '', label: 'All types' }, ...TRANSACTION_TYPE_OPTIONS]}
            className="h-8 w-auto rounded-input border-border bg-background py-0 text-xs shadow-none"
          />
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            options={SORT_OPTIONS}
            className="h-8 w-auto rounded-input border-border bg-background py-0 text-xs shadow-none"
          />
          <Button
            variant="outline"
            className="h-8 rounded-input border-border text-xs font-medium shadow-none"
            onClick={() => load(page, sort, statusId, typeId)}
            disabled={isLoading}
          >
            <RotateCcw className="mr-1 size-3" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <p className="py-4 text-center text-sm text-destructive">{error}</p>
      )}

      {!error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">#</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Sender</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Recipient</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Type</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Status</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Date</th>
                <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="py-3 pr-4">
                          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                        </td>
                      ))}
                    </tr>
                  ))
                : transactions.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        No transactions found.
                      </td>
                    </tr>
                  )
                  : transactions.map((tx) => {
                      const { label: statusLabel, variant } = getTransactionStatus(
                        tx.status_id,
                        tx.has_pending_refund,
                      )
                      return (
                        <tr key={tx.transaction_id} className="transition-colors hover:bg-muted/30">
                          <td className="py-3 pr-4 text-xs font-medium tabular-nums text-muted-foreground">
                            #{tx.transaction_id}
                          </td>
                          <td className="py-3 pr-4">
                            <PartyCell party={tx.sender} />
                          </td>
                          <td className="py-3 pr-4">
                            <PartyCell party={tx.recipient} />
                          </td>
                          <td className="py-3 pr-4 text-xs text-muted-foreground">
                            {getTransactionType(tx.transaction_type_id)}
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex h-5 items-center rounded-chip border px-2 text-[11px] font-semibold ${STATUS_CHIP[variant] ?? STATUS_CHIP.secondary}`}
                            >
                              {statusLabel}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-xs whitespace-nowrap text-muted-foreground">
                            {formatTransactionDate(tx.created_at)}
                          </td>
                          <td className="py-3 text-right text-xs font-semibold tabular-nums text-card-foreground">
                            {formatTransactionAmount(tx.amount)}
                          </td>
                        </tr>
                      )
                    })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            className="h-8 rounded-input border-border text-xs shadow-none"
            disabled={page <= 1 || isLoading}
            onClick={() => load(page - 1, sort, statusId, typeId)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            className="h-8 rounded-input border-border text-xs shadow-none"
            disabled={page >= totalPages || isLoading}
            onClick={() => load(page + 1, sort, statusId, typeId)}
          >
            Next
          </Button>
        </div>
      )}
    </article>
  )
}
