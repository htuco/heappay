import { useCallback, useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import transactionsService from '@/services/transactionsService'
import RefundRequestDialog from '@/components/admin/RefundRequestDialog'

const PAGE_SIZE = 10

function formatAmount(amount) {
  const num = Number.parseFloat(amount ?? '0')
  if (Number.isNaN(num)) return '—'
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function AdminTransactionsPanel() {
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
    <article className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <RotateCcw className="size-4" strokeWidth={2} />
          </span>
          <h2 className="text-base font-semibold text-card-foreground">Refund Requests</h2>
          {total > 0 && (
            <Badge variant="warning" className="text-xs">{total} pending</Badge>
          )}
        </div>
        <Button
          variant="outline"
          className="h-8 rounded-xl border-border text-xs font-medium shadow-none"
          onClick={() => load(page)}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive py-4 text-center">{error}</p>
      )}

      {!error && (
        <div className="overflow-hidden rounded-2xl border border-border">
          {/* Column headers — table layout at sm+, stacked cards below */}
          {!isLoading && requests.length > 0 && (
            <div className="hidden border-b border-border bg-muted/40 px-4 py-2.5 sm:grid sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_160px_92px] sm:gap-x-4">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Request</span>
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Transaction</span>
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Reason</span>
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Submitted</span>
              <span />
            </div>
          )}

          <div className="divide-y divide-border/60">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="hidden px-4 py-3 sm:grid sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_160px_92px] sm:items-center sm:gap-x-4"
                >
                  {Array.from({ length: 5 }).map((__, j) => (
                    <div key={j} className="h-3 w-20 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ))
            ) : requests.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No pending refund requests.
              </div>
            ) : (
              requests.map((req) => (
                <div
                  key={req.request_id}
                  className="group flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:grid sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_160px_92px] sm:items-center sm:gap-x-4 sm:gap-y-0"
                >
                  {/* Request + transaction: inline pair on mobile, separate columns at sm+ */}
                  <div className="flex items-center justify-between gap-3 sm:contents">
                    <span className="font-medium text-card-foreground">#{req.request_id}</span>
                    <span className="text-muted-foreground">
                      <span className="mr-1 text-xs uppercase tracking-wider text-muted-foreground/70 sm:hidden">Txn</span>
                      #{req.refund_detail?.transaction_id ?? '—'}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <span className="block truncate text-card-foreground" title={req.note ?? ''}>
                      {req.note ?? <span className="italic text-muted-foreground">No reason</span>}
                    </span>
                  </div>

                  <span className="text-xs text-muted-foreground sm:whitespace-nowrap">
                    {formatDate(req.created_at)}
                  </span>

                  <div className="flex sm:justify-end">
                    <Button
                      variant="outline"
                      className="h-9 w-full rounded-lg border-border px-3 text-xs font-medium shadow-none transition-opacity touch-manipulation sm:h-7 sm:w-auto sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={() => setSelectedRequest(req)}
                    >
                      Review
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            className="h-8 rounded-xl border-border text-xs shadow-none"
            disabled={page <= 1 || isLoading}
            onClick={() => load(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            className="h-8 rounded-xl border-border text-xs shadow-none"
            disabled={page >= totalPages || isLoading}
            onClick={() => load(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <RefundRequestDialog
        request={selectedRequest}
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => { if (!open) setSelectedRequest(null) }}
        onResolved={handleResolved}
      />
    </article>
  )
}
