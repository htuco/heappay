import { useEffect, useMemo, useState } from 'react'
import { Download, Search, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import TransactionHistoryEmptyState from '@/components/payment/TransactionHistoryEmptyState'
import TransactionHistoryErrorState from '@/components/payment/TransactionHistoryErrorState'
import TransactionHistoryRow from '@/components/payment/TransactionHistoryRow'
import TransactionHistorySkeleton from '@/components/payment/TransactionHistorySkeleton'
import { useTransactions } from '@/hooks/useTransactions'
import { useTransactionFilterParams } from '@/hooks/useTransactionFilterParams'
import { useDashboardCards } from '@/hooks/useDashboardCards'
import { useAppSelector } from '@/store/hooks'
import { selectTransactionCategories } from '@/store/slices/referenceDataSlice'
import { formatBrandLabel } from '@/utils/paymentCard.utils'
import { exportService } from '@/services/exportService'
import { useNotifications } from '@/context/NotificationContext'
import {
  TRANSACTION_STATUS_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  buildCategoryOptions,
  getTransactionStatus,
  transactionMatchesLookup,
} from '@/components/payment/transactionHistory.utils'

const STATUS_DOT_BY_VARIANT = {
  warning: 'bg-warning',
  success: 'bg-success',
  error: 'bg-destructive',
  secondary: 'bg-muted-foreground/60',
}

const DATE_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
]

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})

function getTransactionMonthGroup(transaction) {
  const date = new Date(transaction.created_at)
  if (Number.isNaN(date.getTime())) {
    return { key: 'unknown', label: 'Unknown date' }
  }

  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: MONTH_LABEL_FORMATTER.format(date),
  }
}

export default function TransactionHistory({ onTransactionSelect, onRefreshReady, pageSize = 20 }) {
  const [lookupValue, setLookupValue] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const { filters, setFilters, clearFilters: clearUrlFilters } = useTransactionFilterParams()
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const cardFilter = searchParams.get('card') || 'all'
  const categoryFilter = searchParams.get('category') || 'all'
  const dateFilter = filters.from

  const setCardFilter = (value) => {
    const params = new URLSearchParams(searchParams)
    if (!value || value === 'all') params.delete('card')
    else params.set('card', String(value))
    setSearchParams(params, { replace: true })
  }

  const setCategoryFilter = (value) => {
    const params = new URLSearchParams(searchParams)
    if (!value || value === 'all') params.delete('category')
    else params.set('category', String(value))
    setSearchParams(params, { replace: true })
  }

  const statusFilter = filters.status || 'all'
  const typeFilter = filters.type || 'all'
  const dateSort = filters.sort || 'newest'

  const { notify } = useNotifications()
  const categories = useAppSelector(selectTransactionCategories)
  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories])

  // Card options come from the user's own cards. Scoping by card is applied
  // server-side via the hook's `cardId`, so the "X of N" count stays truthful.
  const { cards } = useDashboardCards()
  const cardOptions = useMemo(
    () =>
      (cards ?? []).map((card) => ({
        value: card.id,
        label: `${formatBrandLabel(card.card?.brand)} ···· ${card.source?.last_four ?? '????'}`,
      })),
    [cards],
  )

  // Status + type filter server-side so matches on other pages aren't hidden and
  // the "X of N" count stays truthful. Date + search stay client-side (current page).
  const statusId = statusFilter === 'all' ? undefined : Number(statusFilter)
  const transactionTypeId = typeFilter === 'all' ? undefined : Number(typeFilter)
  const cardId = cardFilter === 'all' ? undefined : Number(cardFilter)
  const categoryId = categoryFilter === 'all' ? undefined : Number(categoryFilter)
  const fromDate = dateFilter || undefined
  const toDate = filters.to || dateFilter || undefined

  const { transactions, isLoading, error, page, totalPages, total, setPage, refresh } =
    useTransactions({
      pageSize,
      statusId,
      transactionTypeId,
      cardId,
      categoryId,
      fromDate,
      toDate,
      sort: dateSort,
    })

  // Expose the list refresh to the parent (PaymentPage) so actions that change a
  // transaction's status — e.g. cancelling a pending payment — can refetch.
  useEffect(() => {
    onRefreshReady?.(refresh)
  }, [onRefreshReady, refresh])

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => transactionMatchesLookup(t, lookupValue))
  }, [transactions, lookupValue])

  const hasTransactions = transactions.length > 0
  const hasFiltered = filteredTransactions.length > 0
  const statusSummary = useMemo(() => {
    const counts = new Map()
    filteredTransactions.forEach((transaction) => {
      const { label, variant } = getTransactionStatus(transaction.status_id)
      const existing = counts.get(label)
      if (existing) {
        existing.count += 1
      } else {
        counts.set(label, { label, variant, count: 1 })
      }
    })
    return Array.from(counts.values()).sort((a, b) => b.count - a.count)
  }, [filteredTransactions])
  const groupedTransactions = useMemo(() => {
    const groups = []
    const groupByKey = new Map()

    filteredTransactions.forEach((transaction) => {
      const { key, label } = getTransactionMonthGroup(transaction)
      let group = groupByKey.get(key)

      if (!group) {
        group = { key, label, items: [] }
        groupByKey.set(key, group)
        groups.push(group)
      }

      group.items.push(transaction)
    })

    return groups
  }, [filteredTransactions])
  const isFilterActive =
    lookupValue.trim() ||
    dateFilter ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    cardFilter !== 'all' ||
    categoryFilter !== 'all' ||
    dateSort !== 'newest'

  async function handleExportPdf() {
    if (isExportingPdf) return
    setIsExportingPdf(true)
    try {
      await exportService.transactionsPdf({ statusId, transactionTypeId, categoryId, sort: dateSort })
      notify({ type: 'success', message: 'Transactions exported as PDF.', surface: 'toast' })
    } catch (err) {
      notify({
        type: 'error',
        message: err?.message ?? 'Could not export transactions.',
        surface: 'toast',
      })
    } finally {
      setIsExportingPdf(false)
    }
  }

  function clearFilters() {
    setLookupValue('')
    clearUrlFilters()
    setCardFilter('all')
    setCategoryFilter('all')
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Filter toolbar */}
      {!error ? (
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          {/* Search — full row on phone, grows to fill space at md+ */}
          <div className="relative md:min-w-40 md:flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              type="search"
              value={lookupValue}
              onChange={(e) => setLookupValue(e.target.value)}
              placeholder="Search transactions…"
              disabled={!hasTransactions && !isLoading}
              className="h-8 rounded-input border-border/70 bg-background pl-8 text-sm shadow-none placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {/* Filters — two-up grid on phone, inline at md+ */}
          <div className="grid grid-cols-2 gap-2 md:contents">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                const value = e.target.value
                setFilters({ from: value, to: value })
              }}
              disabled={!hasTransactions && !isLoading}
              className="h-8 rounded-input border-border/70 bg-background text-sm shadow-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:w-auto"
            />

            <Select
              value={statusFilter}
              onChange={(e) => setFilters({ status: e.target.value === 'all' ? '' : e.target.value })}
              disabled={!hasTransactions && !isLoading}
              options={[{ value: 'all', label: 'All statuses' }, ...TRANSACTION_STATUS_OPTIONS]}
              className="h-8 rounded-input border-border/70 bg-background py-0 shadow-none md:w-auto"
            />

            <Select
              value={typeFilter}
              onChange={(e) => setFilters({ type: e.target.value === 'all' ? '' : e.target.value })}
              disabled={!hasTransactions && !isLoading}
              options={[{ value: 'all', label: 'All types' }, ...TRANSACTION_TYPE_OPTIONS]}
              className="h-8 rounded-input border-border/70 bg-background py-0 shadow-none md:w-auto"
            />

            {cardOptions.length > 1 ? (
              <Select
                value={cardFilter}
                onChange={(e) => setCardFilter(e.target.value)}
                options={[{ value: 'all', label: 'All cards' }, ...cardOptions]}
                className="h-8 rounded-input border-border/70 bg-background py-0 shadow-none md:w-auto"
              />
            ) : null}

            {categoryOptions.length > 0 ? (
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                disabled={!hasTransactions && !isLoading}
                options={[{ value: 'all', label: 'All categories' }, ...categoryOptions]}
                className="h-8 rounded-input border-border/70 bg-background py-0 shadow-none md:w-auto"
              />
            ) : null}

            <Select
              value={dateSort}
              onChange={(e) => setFilters({ sort: e.target.value })}
              disabled={!hasTransactions && !isLoading}
              options={DATE_SORT_OPTIONS}
              className="h-8 rounded-input border-border/70 bg-background py-0 shadow-none md:w-auto"
            />
          </div>

          {/* Clear + export + count — one row on phone, inline at md+ */}
          <div className="flex items-center gap-2 md:contents">
            {isFilterActive ? (
              <Button
                variant="ghost"
                className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                onClick={clearFilters}
              >
                <X className="h-3 w-3" />
                Clear
              </Button>
            ) : null}

            {hasTransactions ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-input border-border/70 px-2.5 text-xs shadow-none"
                disabled={isExportingPdf}
                onClick={handleExportPdf}
              >
                <Download className="h-3.5 w-3.5" />
                {isExportingPdf ? 'Exporting…' : 'Export PDF'}
              </Button>
            ) : null}

            {/* Transaction count — right-aligned in toolbar */}
            {!isLoading ? (
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {isFilterActive
                  ? `${filteredTransactions.length} of ${total} transactions`
                  : `${total} transaction${total !== 1 ? 's' : ''}`}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Status summary */}
      {!error && !isLoading && hasFiltered && statusSummary.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {statusSummary.map(({ label, variant, count }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-chip border border-border/70 bg-card px-2.5 py-1 text-xs text-muted-foreground"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_BY_VARIANT[variant] ?? 'bg-muted-foreground/60'}`}
              />
              <span className="font-semibold tabular-nums text-card-foreground">{count}</span>
              <span>{label}</span>
            </span>
          ))}
        </div>
      ) : null}

      {/* Table — @container/tbl so rows switch to the multi-column grid based on
          the table's own width (matches the Wallet activity table). Without this
          the row's @[560px]/tbl breakpoint has no container and both the stacked
          and grid layouts render at once. */}
      <div className="@container/tbl overflow-hidden rounded-input border border-border/80 bg-card shadow-sm">
        {/* Column headers */}
        {!error && !isLoading && hasFiltered ? (
          <div className="hidden border-b border-border/60 bg-muted/30 px-4 py-2.5 @[560px]/tbl:grid @[560px]/tbl:grid-cols-[28px_1fr_84px_120px_84px_128px_92px] @[560px]/tbl:gap-x-4">
            <span />
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Transaction</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Type</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Category</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Status</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Date</span>
            <span className="text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Amount</span>
          </div>
        ) : null}

        {error ? <TransactionHistoryErrorState message={error.message} onRetry={refresh} /> : null}
        {!error && isLoading ? <TransactionHistorySkeleton /> : null}
        {!error && !isLoading && !hasTransactions ? <TransactionHistoryEmptyState /> : null}
        {!error && !isLoading && hasTransactions && !hasFiltered ? (
          <TransactionHistoryEmptyState
            title="No matching transactions"
            message="Try adjusting your search or filters."
          />
        ) : null}

        {!error && !isLoading && hasFiltered ? (
          <div>
            {groupedTransactions.map((group) => (
              <section key={group.key} aria-label={`${group.label} transactions`}>
                <div className="border-b border-border/50 bg-muted/20 px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </p>
                    <span className="rounded-chip bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border/70">
                      {group.items.length} transaction{group.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-border/40">
                  {group.items.map((transaction) => (
                    <TransactionHistoryRow
                      key={transaction.transaction_id}
                      transaction={transaction}
                      onSelect={onTransactionSelect}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>

      {/* Pagination */}
      {!error && totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-input border-border/70 text-xs shadow-none"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-input border-border/70 text-xs shadow-none"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
