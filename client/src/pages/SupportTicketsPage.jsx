import { useCallback, useEffect, useState } from 'react'
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
    <div className="mx-auto max-w-5xl">
      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-2">
        <Button
          variant="outline"
          className="h-8 rounded-input border-border/70 text-xs shadow-none"
          onClick={() => load(page)}
          disabled={isLoading}
        >
          Refresh
        </Button>
        {!isLoading && (
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {total} pending ticket{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {/* Table */}
      <div className="overflow-hidden rounded-input border border-border/80 bg-card shadow-sm">
        {!isLoading && requests.length > 0 && (
          <div className="hidden border-b border-border/60 bg-muted/30 px-4 py-2.5 sm:grid sm:grid-cols-[60px_1fr_1fr_160px_80px] sm:gap-x-4">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">#</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Transaction</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Reason</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Submitted</span>
            <span />
          </div>
        )}

        <div className="divide-y divide-border/40">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="hidden px-4 py-3 sm:grid sm:grid-cols-[60px_1fr_1fr_160px_80px] sm:items-center sm:gap-x-4">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <div key={j} className="h-3 w-20 animate-pulse rounded-input bg-muted" />
                  ))}
                </div>
              ))
            : requests.length === 0
            ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No pending refund requests.
              </div>
            )
            : requests.map((req) => (
              <div
                key={req.request_id}
                className="group grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-2.5 transition-colors hover:bg-muted/20 sm:grid-cols-[60px_1fr_1fr_160px_80px]"
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
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    className="h-7 rounded-input px-3 text-xs shadow-none opacity-0 group-hover:opacity-100 transition-opacity"
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

      {/* Pagination */}
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
