import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, TicketCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import RefundRequestDialog from '@/components/admin/RefundRequestDialog'
import transactionsService from '@/services/transactionsService'

const PAGE_SIZE = 20

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function SupportTicketsPage() {
  const [requests, setRequests] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback(async (p = 1) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await transactionsService.listPendingRefunds({ page: p, pageSize: PAGE_SIZE })
      setRequests(result.items ?? [])
      setTotal(result.total ?? 0)
      setPage(p)
    } catch {
      setError('Failed to load refund requests.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load(1) }, [load])

  function handleResolved() {
    setSelectedRequest(null)
    load(page)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="rounded-surface border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="outline"
            size="lg"
            className="h-9 w-full gap-2 border-border/70 text-xs shadow-none sm:w-auto"
            onClick={() => load(page)}
            disabled={isLoading}
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {isLoading ? 'Loading tickets...' : `${total} pending ticket${total !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-surface border border-border bg-card shadow-xs">
        {!isLoading && requests.length > 0 && (
          <div className="hidden border-b border-border/60 bg-muted/30 px-4 py-2.5 sm:grid sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_160px_88px_92px] sm:gap-x-4">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">#</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Transaction</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Reason</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Submitted</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Status</span>
            <span />
          </div>
        )}

        <div className="divide-y divide-border/40">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="hidden px-4 py-3 sm:grid sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_160px_88px_92px] sm:items-center sm:gap-x-4">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <div key={j} className="h-3 w-20 animate-pulse rounded-input bg-muted" />
                  ))}
                </div>
              ))
            : requests.length === 0
            ? (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
                <span className="flex size-11 items-center justify-center rounded-input bg-primary/10 text-primary">
                  <TicketCheck className="size-5" strokeWidth={1.8} />
                </span>
                <p className="text-sm font-medium text-foreground">No pending refund requests.</p>
              </div>
            )
            : requests.map((req) => (
              <div
                key={req.request_id}
                className="group grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-3 transition-colors hover:bg-muted/20 sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_160px_88px_92px]"
              >
                <span className="text-sm font-medium text-foreground">#{req.request_id}</span>
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
                  {formatDate(req.created_at)}
                </span>
                <span className="hidden sm:block">
                  <Badge variant="warning" className="text-[11px]">
                    Pending
                  </Badge>
                </span>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    className="h-7 rounded-input px-3 text-xs opacity-100 shadow-none transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={() => setSelectedRequest(req)}
                  >
                    Review
                  </Button>
                </div>
              </div>
            ))
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
