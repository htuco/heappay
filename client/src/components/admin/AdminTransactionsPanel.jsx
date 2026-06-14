import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, RefreshCw, Search, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import transactionsService from '@/services/transactionsService'
import {
  TX_SORT_OPTIONS,
  TX_STATUS_FILTER_OPTIONS,
  TX_STATUS_META,
  TX_TYPE_FILTER_OPTIONS,
  TX_TYPE_META,
  formatUsd,
} from '@/utils/transactionMeta'

const PAGE_SIZE = 10

function formatDate(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function partyName(party, fallback) {
  if (!party) return fallback
  return party.full_name || [party.first_name, party.last_name].filter(Boolean).join(' ') || party.cardholder_name || fallback
}

function partyDetail(party) {
  if (!party) return null
  const card = party.last_four ? `${party.brand ?? 'Card'} •••• ${party.last_four}` : null
  return [party.email, card].filter(Boolean).join(' · ') || null
}

function PartyCell({ tx }) {
  const sender = partyName(tx.sender, 'External deposit')
  const recipient = partyName(tx.recipient, 'Unknown recipient')
  const senderDetail = partyDetail(tx.sender)
  const recipientDetail = partyDetail(tx.recipient)
  const detail = [senderDetail ? `From ${senderDetail}` : null, recipientDetail ? `To ${recipientDetail}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-card-foreground">
        <span className="text-muted-foreground">#{tx.transaction_id}</span>
        <span className="mx-1.5 text-muted-foreground/60">·</span>
        {sender}
        <span className="mx-1.5 text-muted-foreground/60">→</span>
        {recipient}
      </p>
      {detail ? (
        <p className="truncate text-[11px] text-muted-foreground" title={detail}>{detail}</p>
      ) : null}
      {tx.note ? (
        <p className="truncate text-[11px] text-muted-foreground/80" title={tx.note}>{tx.note}</p>
      ) : null}
    </div>
  )
}

function AuditSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[28px_minmax(0,1fr)_72px] items-center gap-x-4 px-4 py-3 sm:grid-cols-[28px_minmax(0,1fr)_96px_96px_150px_110px]"
        >
          {Array.from({ length: 6 }).map((__, j) => (
            <div key={j} className="h-3 w-full max-w-24 animate-pulse rounded-input bg-muted" />
          ))}
        </div>
      ))}
    </>
  )
}

export default function AdminTransactionsPanel() {
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [idQuery, setIdQuery] = useState('')
  const [lookup, setLookup] = useState(null)
  const [lookupState, setLookupState] = useState('idle') // idle | loading | done | error
  const [lookupError, setLookupError] = useState('')

  async function handleIdLookup(event) {
    event.preventDefault()
    const id = Number(idQuery.trim())
    if (!Number.isInteger(id) || id <= 0) {
      setLookupState('error')
      setLookupError('Enter a valid transaction ID.')
      setLookup(null)
      return
    }
    setLookupState('loading')
    setLookupError('')
    try {
      const tx = await transactionsService.getByIdAsStaff(id)
      setLookup(tx)
      setLookupState('done')
    } catch (err) {
      setLookup(null)
      setLookupState('error')
      setLookupError(err?.status === 404 ? `No transaction found with ID #${id}.` : 'Lookup failed.')
    }
  }

  function clearLookup() {
    setIdQuery('')
    setLookup(null)
    setLookupState('idle')
    setLookupError('')
  }

  const queryParams = useMemo(() => ({
    pageSize: PAGE_SIZE,
    statusId: statusFilter === 'all' ? undefined : Number(statusFilter),
    transactionTypeId: typeFilter === 'all' ? undefined : Number(typeFilter),
    sort,
  }), [sort, statusFilter, typeFilter])

  const load = useCallback(async (p = 1) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await transactionsService.listAll({ ...queryParams, page: p })
      setData(result)
      setPage(p)
    } catch {
      setError('Failed to load transactions.')
    } finally {
      setIsLoading(false)
    }
  }, [queryParams])

  useEffect(() => {
    load(1)
  }, [load])

  function handleRefresh() {
    load(page)
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, data?.total_pages ?? Math.ceil(total / PAGE_SIZE))

  return (
    <article className="rounded-panel border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-input bg-primary/10 text-primary">
              <Activity className="size-4" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-card-foreground">Transactions Audit</h2>
              <p className="text-xs text-muted-foreground">
                {isLoading ? 'Loading…' : `${total.toLocaleString('en-US')} transaction${total !== 1 ? 's' : ''} across all users`}
              </p>
            </div>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] lg:w-auto">
            <Select
              aria-label="Filter transactions by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              options={TX_STATUS_FILTER_OPTIONS}
              className="h-9 py-0 text-xs shadow-none sm:w-36"
            />
            <Select
              aria-label="Filter transactions by type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              options={TX_TYPE_FILTER_OPTIONS}
              className="h-9 py-0 text-xs shadow-none sm:w-36"
            />
            <Select
              aria-label="Sort transactions"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              options={TX_SORT_OPTIONS}
              className="h-9 py-0 text-xs shadow-none sm:w-36"
            />
            <Button
              variant="outline"
              className="h-9 gap-2 rounded-input border-border text-xs font-medium shadow-none"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </Button>
          </div>
        </div>

        <form onSubmit={handleIdLookup} className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={idQuery}
              onChange={(event) => setIdQuery(event.target.value)}
              inputMode="numeric"
              placeholder="Look up a transaction by ID…"
              className="h-9 border-border/70 bg-background pl-9 pr-9 text-sm shadow-none"
            />
            {idQuery ? (
              <button
                type="button"
                onClick={clearLookup}
                aria-label="Clear lookup"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-input p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
          <Button
            type="submit"
            variant="outline"
            className="h-9 gap-2 rounded-input border-border text-xs font-medium shadow-none"
            disabled={lookupState === 'loading' || !idQuery.trim()}
          >
            {lookupState === 'loading' ? 'Searching…' : 'Find'}
          </Button>
        </form>

        {lookupState === 'error' ? (
          <p className="mb-4 rounded-surface border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {lookupError}
          </p>
        ) : null}

        {lookupState === 'done' && lookup ? (
          <div className="mb-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Lookup result
            </p>
            <div className="overflow-hidden rounded-surface border border-primary/30 bg-primary/5">
              {(() => {
                const typeMeta = TX_TYPE_META[lookup.transaction_type_id] ?? TX_TYPE_META[1]
                const statusMeta = TX_STATUS_META[lookup.status_id] ?? TX_STATUS_META[1]
                const TypeIcon = typeMeta.Icon
                return (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-input ${typeMeta.bg}`}>
                      <TypeIcon className={`size-4 ${typeMeta.color}`} strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <PartyCell tx={lookup} />
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">{typeMeta.label}</span>
                        <Badge variant={statusMeta.variant} className="text-[11px]">{statusMeta.label}</Badge>
                        <span className="text-xs tabular-nums text-muted-foreground">{formatDate(lookup.created_at)}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-card-foreground">
                      {formatUsd(lookup.amount)}
                    </span>
                  </div>
                )
              })()}
            </div>
          </div>
        ) : null}

        {error ? <p className="py-4 text-center text-sm text-destructive">{error}</p> : null}

        {!error ? (
          <div className="overflow-hidden rounded-surface border border-border">
            <div className="hidden border-b border-border/60 bg-muted/30 px-4 py-2.5 sm:grid sm:grid-cols-[28px_minmax(0,1fr)_96px_96px_150px_110px] sm:gap-x-4">
              <span />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Parties</span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Type</span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Status</span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Date</span>
              <span className="text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Amount</span>
            </div>

            <div className="divide-y divide-border/40">
              {isLoading ? <AuditSkeleton /> : null}

              {!isLoading && items.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No transactions match the current filters.
                </div>
              ) : null}

              {!isLoading
                ? items.map((tx) => {
                    const typeMeta = TX_TYPE_META[tx.transaction_type_id] ?? TX_TYPE_META[1]
                    const statusMeta = TX_STATUS_META[tx.status_id] ?? TX_STATUS_META[1]
                    const TypeIcon = typeMeta.Icon
                    return (
                      <div
                        key={tx.transaction_id}
                        className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3 transition-colors hover:bg-muted/20 sm:grid-cols-[28px_minmax(0,1fr)_96px_96px_150px_110px]"
                      >
                        <span className={`flex size-7 shrink-0 items-center justify-center rounded-input ${typeMeta.bg}`}>
                          <TypeIcon className={`size-3.5 ${typeMeta.color}`} strokeWidth={2} />
                        </span>
                        <div className="min-w-0">
                          <PartyCell tx={tx} />
                          <div className="mt-1 flex flex-wrap items-center gap-2 sm:hidden">
                            <span className="text-xs text-muted-foreground">{typeMeta.label}</span>
                            <Badge variant={statusMeta.variant} className="text-[11px]">{statusMeta.label}</Badge>
                            <span className="text-xs tabular-nums text-muted-foreground">{formatDate(tx.created_at)}</span>
                          </div>
                        </div>
                        <span className="hidden text-xs text-muted-foreground sm:block">{typeMeta.label}</span>
                        <span className="hidden sm:block">
                          <Badge variant={statusMeta.variant} className="text-[11px]">{statusMeta.label}</Badge>
                        </span>
                        <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
                          {formatDate(tx.created_at)}
                        </span>
                        <span className="text-right text-sm font-semibold tabular-nums text-card-foreground">
                          {formatUsd(tx.amount)}
                        </span>
                      </div>
                    )
                  })
                : null}
            </div>
          </div>
        ) : null}

        {!error && totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-input text-xs shadow-none"
              disabled={page <= 1 || isLoading}
              onClick={() => load(page - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-input text-xs shadow-none"
              disabled={page >= totalPages || isLoading}
              onClick={() => load(page + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
    </article>
  )
}
