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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Request</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Transaction</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Reason</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Submitted</th>
                <th className="pb-2 text-xs font-medium text-muted-foreground" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="py-3 pr-4">
                        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No pending refund requests.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.request_id} className="group hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4 font-medium text-card-foreground">
                      #{req.request_id}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      #{req.refund_detail?.transaction_id ?? '—'}
                    </td>
                    <td className="py-3 pr-4 max-w-[180px]">
                      <span className="block truncate text-card-foreground" title={req.note ?? ''}>
                        {req.note ?? <span className="text-muted-foreground italic">No reason</span>}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                      {formatDate(req.created_at)}
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        variant="outline"
                        className="h-7 rounded-lg border-border px-3 text-xs font-medium shadow-none opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setSelectedRequest(req)}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
