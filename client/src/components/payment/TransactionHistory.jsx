import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import TransactionHistoryEmptyState from '@/components/payment/TransactionHistoryEmptyState'
import TransactionHistoryErrorState from '@/components/payment/TransactionHistoryErrorState'
import TransactionHistoryRow from '@/components/payment/TransactionHistoryRow'
import TransactionHistorySkeleton from '@/components/payment/TransactionHistorySkeleton'
import { useTransactions } from '@/hooks/useTransactions'
import {
  TRANSACTION_STATUS_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  transactionMatchesFilters,
  transactionMatchesLookup,
} from '@/components/payment/transactionHistory.utils'

const DATE_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
]

export default function TransactionHistory({ onTransactionSelect, pageSize = 12 }) {
  const [lookupValue, setLookupValue] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateSort, setDateSort] = useState('newest')
  const {
    transactions,
    isLoading,
    error,
    page,
    totalPages,
    total,
    setPage,
    refresh,
  } = useTransactions({ pageSize })
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((transaction) => transactionMatchesLookup(transaction, lookupValue))
      .filter((transaction) =>
        transactionMatchesFilters(transaction, {
          date: dateFilter,
          status: statusFilter,
          type: typeFilter,
        }),
      )
      .sort((first, second) => {
        const firstDate = new Date(first.created_at).getTime() || 0
        const secondDate = new Date(second.created_at).getTime() || 0
        return dateSort === 'newest' ? secondDate - firstDate : firstDate - secondDate
      })
  }, [transactions, lookupValue, dateFilter, statusFilter, typeFilter, dateSort])
  const hasTransactions = transactions.length > 0
  const hasFilteredTransactions = filteredTransactions.length > 0
  const isLookupActive = lookupValue.trim().length > 0
  const isFilterActive =
    isLookupActive || dateFilter || statusFilter !== 'all' || typeFilter !== 'all' || dateSort !== 'newest'
  const canGoBack = page > 1 && !isLoading
  const canGoForward = page < totalPages && !isLoading

  function clearFilters() {
    setLookupValue('')
    setDateFilter('')
    setStatusFilter('all')
    setTypeFilter('all')
    setDateSort('newest')
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Payment activity
          </p>
          <h2 className="mt-1 text-xl font-semibold text-card-foreground">Transaction History</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Recent payments and transfers loaded from the transaction API.
          </p>
        </div>

        <div className="flex w-fit items-baseline gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
          <p className="text-base font-semibold tabular-nums text-card-foreground">{total}</p>
          <p className="text-xs font-medium text-muted-foreground">
            {total === 1 ? 'transaction' : 'transactions'}
          </p>
        </div>
      </div>

      {!error && !isLoading ? (
        <div className="mb-4 border-b border-border pb-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(140px,auto))_auto] lg:items-end">
            <div className="relative min-w-0">
              <label htmlFor="transaction-lookup" className="mb-1 block text-xs font-medium text-muted-foreground">
                Search
              </label>
              <Search className="pointer-events-none absolute left-2.5 top-[2.05rem] h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="transaction-lookup"
                type="search"
                value={lookupValue}
                onChange={(event) => setLookupValue(event.target.value)}
                placeholder="Look up transaction"
                disabled={!hasTransactions}
                className="h-9 border border-border bg-background pl-8"
              />
            </div>

            <div>
              <label htmlFor="transaction-date-filter" className="mb-1 block text-xs font-medium text-muted-foreground">
                Date
              </label>
              <Input
                id="transaction-date-filter"
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                disabled={!hasTransactions}
                className="h-9 border border-border bg-background"
              />
            </div>

            <div>
              <label htmlFor="transaction-status-filter" className="mb-1 block text-xs font-medium text-muted-foreground">
                Status
              </label>
              <Select
                id="transaction-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                disabled={!hasTransactions}
                options={[
                  { value: 'all', label: 'All statuses' },
                  ...TRANSACTION_STATUS_OPTIONS,
                ]}
                className="h-9 border border-border bg-background py-0"
              />
            </div>

            <div>
              <label htmlFor="transaction-type-filter" className="mb-1 block text-xs font-medium text-muted-foreground">
                Type
              </label>
              <Select
                id="transaction-type-filter"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                disabled={!hasTransactions}
                options={[
                  { value: 'all', label: 'All types' },
                  ...TRANSACTION_TYPE_OPTIONS,
                ]}
                className="h-9 border border-border bg-background py-0"
              />
            </div>

            <div>
              <label htmlFor="transaction-date-sort" className="mb-1 block text-xs font-medium text-muted-foreground">
                Sort
              </label>
              <Select
                id="transaction-date-sort"
                value={dateSort}
                onChange={(event) => setDateSort(event.target.value)}
                disabled={!hasTransactions}
                options={DATE_SORT_OPTIONS}
                className="h-9 border border-border bg-background py-0"
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Reset</p>
              <Button
                variant="outline"
                size="lg"
                className="h-9 w-full justify-center px-3 lg:w-auto"
                disabled={!isFilterActive}
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5" />
                Clear filters
              </Button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <p className="text-xs text-muted-foreground">
              {hasTransactions ? `${filteredTransactions.length} shown` : 'No history yet'}
            </p>
          </div>
        </div>
      ) : null}

      {error ? <TransactionHistoryErrorState message={error.message} onRetry={refresh} /> : null}
      {!error && isLoading ? <TransactionHistorySkeleton /> : null}
      {!error && !isLoading && !hasTransactions ? <TransactionHistoryEmptyState /> : null}
      {!error && !isLoading && hasTransactions && !hasFilteredTransactions ? (
        <TransactionHistoryEmptyState
          title="No matching transactions"
          message="Try another transaction ID, date, status, type, card number, note, or amount on this page."
        />
      ) : null}
      {!error && !isLoading && hasFilteredTransactions ? (
        <div className="space-y-3">
          {filteredTransactions.map((transaction) => (
            <TransactionHistoryRow
              key={transaction.transaction_id}
              transaction={transaction}
              onSelect={onTransactionSelect}
            />
          ))}
        </div>
      ) : null}

      {!error && totalPages > 1 ? (
        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={!canGoBack}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={!canGoForward}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
