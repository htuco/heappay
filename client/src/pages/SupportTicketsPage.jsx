import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock3, RefreshCw, TicketCheck, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import RefundRequestDialog from '@/components/admin/RefundRequestDialog'
import transactionsService from '@/services/transactionsService'
import { REQUEST_STATUS_META, REQUEST_STATUS_IDS } from '@/utils/requestStatus'

const PAGE_SIZE = 20

const FILTER_OPTIONS = [
  { label: 'Pending', value: String(REQUEST_STATUS_IDS.pending) },
  { label: 'Approved', value: String(REQUEST_STATUS_IDS.approved) },
  { label: 'Declined', value: String(REQUEST_STATUS_IDS.declined) },
  { label: 'Cancelled', value: String(REQUEST_STATUS_IDS.cancelled) },
  { label: 'All', value: 'all' },
]

const STAT_TILES = [
  { key: 'pending', label: 'Pending', Icon: Clock3, iconClass: 'bg-warning/10 text-warning' },
  { key: 'approved', label: 'Approved', Icon: CheckCircle2, iconClass: 'bg-success/10 text-success' },
  { key: 'declined', label: 'Declined', Icon: XCircle, iconClass: 'bg-destructive/10 text-destructive' },
  { key: 'total', label: 'All Requests', Icon: TicketCheck, iconClass: 'bg-primary/10 text-primary' },
]

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function StatusBadge({ statusId }) {
  const meta = REQUEST_STATUS_META[statusId] ?? REQUEST_STATUS_META[REQUEST_STATUS_IDS.pending]
  return <Badge variant={meta.variant} className="text-[11px]">{meta.label}</Badge>
}

function StatsStrip({ stats, isLoading }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Refund request stats">
      {STAT_TILES.map(({ key, label, Icon, iconClass }) => (
        <article key={key} className="flex items-center gap-3 rounded-surface border border-border bg-card p-4 shadow-xs">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-input ${iconClass}`}>
            <Icon className="size-4.5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</p>
            {isLoading ? (
              <div className="mt-1 h-5 w-10 animate-pulse rounded bg-muted" />
            ) : (
              <p className="text-lg font-bold tabular-nums text-card-foreground">{stats?.[key] ?? 0}</p>
            )}
          </div>
        </article>
      ))}
    </section>
  )
}

export default function SupportTicketsPage() {
  const [requests, setRequests] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState(String(REQUEST_STATUS_IDS.pending))
  const [stats, setStats] = useState(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true)
    try {
      setStats(await transactionsService.getRequestStats())
    } catch {
      // The list still works without the stats strip; leave the tiles at 0.
    } finally {
      setIsLoadingStats(false)
    }
  }, [])

  const load = useCallback(async (p = 1, filter = statusFilter) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = { page: p, pageSize: PAGE_SIZE }
      if (filter !== 'all') params.statusId = Number(filter)
      const result = await transactionsService.listRefunds(params)
      setRequests(result.items ?? [])
      setTotal(result.total ?? 0)
      setPage(p)
    } catch {
      setError('Failed to load refund requests.')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    load(1)
    loadStats()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilterChange(value) {
    setStatusFilter(value)
    load(1, value)
  }

  function handleRefresh() {
    load(page)
    loadStats()
  }

  function handleResolved() {
    setSelectedRequest(null)
    load(page)
    loadStats()
  }

  const isPendingView = statusFilter === String(REQUEST_STATUS_IDS.pending)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <StatsStrip stats={stats} isLoading={isLoadingStats} />

      <div className="rounded-surface border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={statusFilter === option.value ? 'default' : 'outline'}
                className="h-8 rounded-input px-3 text-xs shadow-none"
                onClick={() => handleFilterChange(option.value)}
                disabled={isLoading && statusFilter === option.value}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">
              {isLoading ? 'Loading requests...' : `${total} request${total !== 1 ? 's' : ''}`}
            </span>
            <Button
              variant="outline"
              size="lg"
              className="h-9 gap-2 border-border/70 text-xs shadow-none"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-surface border border-border bg-card shadow-xs">
        {!isLoading && requests.length > 0 && (
          <div className="hidden border-b border-border/60 bg-muted/30 px-4 py-2.5 sm:grid sm:grid-cols-[56px_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_150px_88px_92px] sm:gap-x-4">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">#</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Requester</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Transaction</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Reason</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {isPendingView ? 'Submitted' : 'Resolved'}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Status</span>
            <span />
          </div>
        )}

        <div className="divide-y divide-border/40">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="hidden px-4 py-3 sm:grid sm:grid-cols-[56px_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_150px_88px_92px] sm:items-center sm:gap-x-4">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <div key={j} className="h-3 w-16 animate-pulse rounded-input bg-muted" />
                  ))}
                </div>
              ))
            : requests.length === 0
            ? (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
                <span className="flex size-11 items-center justify-center rounded-input bg-primary/10 text-primary">
                  <TicketCheck className="size-5" strokeWidth={1.8} />
                </span>
                <p className="text-sm font-medium text-foreground">
                  {isPendingView ? 'No pending refund requests.' : 'No refund requests match this filter.'}
                </p>
              </div>
            )
            : requests.map((req) => {
              const isPending = req.request_status_id === REQUEST_STATUS_IDS.pending
              return (
                <div
                  key={req.request_id}
                  className="group grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-3 transition-colors hover:bg-muted/20 sm:grid-cols-[56px_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_150px_88px_92px]"
                >
                  <span className="text-sm font-medium text-foreground">#{req.request_id}</span>
                  <span className="hidden truncate text-sm text-foreground sm:block" title={req.requester_name ?? ''}>
                    {req.requester_name ?? `User #${req.requester_user_id}`}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    #{req.refund_detail?.transaction_id ?? '—'}
                    {req.refund_detail?.transaction_amount
                      ? <span className="ml-2 font-medium text-foreground">
                          ${Number(req.refund_detail.transaction_amount).toFixed(2)}
                        </span>
                      : null
                    }
                  </span>
                  <span className="hidden truncate text-sm text-muted-foreground sm:block" title={req.note ?? ''}>
                    {req.note ?? <span className="italic">No reason</span>}
                  </span>
                  <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
                    {formatDate(isPending ? req.created_at : (req.resolved_at ?? req.created_at))}
                  </span>
                  <span className="hidden sm:block">
                    <StatusBadge statusId={req.request_status_id} />
                  </span>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      className="h-7 rounded-input px-3 text-xs opacity-100 shadow-none transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={() => setSelectedRequest(req)}
                    >
                      {isPending ? 'Review' : 'View'}
                    </Button>
                  </div>
                </div>
              )
            })
          }
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 rounded-input text-xs shadow-none" disabled={page <= 1 || isLoading} onClick={() => load(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" className="h-8 rounded-input text-xs shadow-none" disabled={page >= totalPages || isLoading} onClick={() => load(page + 1)}>Next</Button>
          </div>
        </div>
      )}

      <RefundRequestDialog
        request={selectedRequest}
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => { if (!open) setSelectedRequest(null) }}
        onResolved={handleResolved}
      />
    </div>
  )
}
