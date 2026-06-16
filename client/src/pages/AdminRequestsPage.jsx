import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import RefundRequestDialog from '@/components/admin/RefundRequestDialog'
import FreezeRequestDialog from '@/components/admin/FreezeRequestDialog'
import transactionsService from '@/services/transactionsService'
import { REQUEST_STATUS_IDS, REQUEST_STATUS_META } from '@/utils/requestStatus'

const PAGE_SIZE = 20

const FILTER_OPTIONS = [
  { label: 'Pending', value: String(REQUEST_STATUS_IDS.pending) },
  { label: 'Approved', value: String(REQUEST_STATUS_IDS.approved) },
  { label: 'Declined', value: String(REQUEST_STATUS_IDS.declined) },
  { label: 'All', value: 'all' },
]

const TABS = [
  { key: 'refund', label: 'Refund Requests' },
  { key: 'freeze', label: 'Freeze / Unfreeze' },
]

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StatusBadge({ statusId }) {
  const meta = REQUEST_STATUS_META[statusId] ?? REQUEST_STATUS_META[REQUEST_STATUS_IDS.pending]
  return <Badge variant={meta.variant} className="text-[11px]">{meta.label}</Badge>
}

/**
 * Shared list shell for both request types: filter bar, refresh, pagination,
 * loading / empty states. The caller supplies the fetcher and a row renderer
 * so the refund and freeze tables stay DRY.
 */
function RequestList({ fetchPage, renderRow, emptyLabel, columns }) {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState(String(REQUEST_STATUS_IDS.pending))
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback(
    async (p = 1, filter = statusFilter) => {
      setIsLoading(true)
      setError(null)
      try {
        const params = { page: p, pageSize: PAGE_SIZE }
        if (filter !== 'all') params.statusId = Number(filter)
        const result = await fetchPage(params)
        setItems(result.items ?? [])
        setTotal(result.total ?? 0)
        setPage(p)
      } catch {
        setError('Failed to load requests.')
      } finally {
        setIsLoading(false)
      }
    },
    [fetchPage, statusFilter],
  )

  useEffect(() => {
    load(1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilterChange(value) {
    setStatusFilter(value)
    load(1, value)
  }

  function reload() {
    load(page)
  }

  return (
    <div className="space-y-4">
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
              {isLoading ? 'Loading…' : `${total} request${total !== 1 ? 's' : ''}`}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 border-border/70 text-xs shadow-none"
              onClick={reload}
              disabled={isLoading}
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-surface border border-border bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left">
              {columns.map((col) => (
                <th key={col} className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {col}
                </th>
              ))}
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: columns.length + 1 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              items.map((req) => renderRow(req, reload))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 rounded-input text-xs shadow-none" disabled={page <= 1 || isLoading} onClick={() => load(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-input text-xs shadow-none" disabled={page >= totalPages || isLoading} onClick={() => load(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function RefundTab() {
  const [selected, setSelected] = useState(null)
  // Remounting RequestList via this key after a resolve refetches the list.
  const [reloadToken, setReloadToken] = useState(0)

  function renderRow(req) {
    const isPending = req.request_status_id === REQUEST_STATUS_IDS.pending
    return (
      <tr key={req.request_id} className="transition-colors hover:bg-muted/20">
        <td className="px-4 py-3 text-sm font-medium text-foreground">#{req.request_id}</td>
        <td className="px-4 py-3 text-sm text-foreground">{req.requester_name ?? `User #${req.requester_user_id}`}</td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          #{req.refund_detail?.transaction_id ?? '—'}
          {req.refund_detail?.transaction_amount ? (
            <span className="ml-2 font-medium text-foreground">${Number(req.refund_detail.transaction_amount).toFixed(2)}</span>
          ) : null}
        </td>
        <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
          {formatDate(isPending ? req.created_at : req.resolved_at ?? req.created_at)}
        </td>
        <td className="px-4 py-3"><StatusBadge statusId={req.request_status_id} /></td>
        <td className="px-4 py-3 text-right">
          <Button variant="outline" className="h-7 rounded-input px-3 text-xs shadow-none" onClick={() => setSelected(req)}>
            {isPending ? 'Review' : 'View'}
          </Button>
        </td>
      </tr>
    )
  }

  return (
    <>
      <RequestList
        key={reloadToken}
        fetchPage={(params) => transactionsService.listRefunds(params)}
        renderRow={renderRow}
        emptyLabel="No refund requests match this filter."
        columns={['#', 'Requester', 'Transaction', 'Submitted', 'Status']}
      />
      <RefundRequestDialog
        request={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => { if (!open) setSelected(null) }}
        onResolved={() => { setSelected(null); setReloadToken((t) => t + 1) }}
      />
    </>
  )
}

function FreezeTab() {
  const [selected, setSelected] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  function renderRow(req) {
    const isPending = req.request_status_id === REQUEST_STATUS_IDS.pending
    const detail = req.card_freeze_detail
    const isUnfreeze = req.request_type_name === 'card_unfreeze'
    return (
      <tr key={req.request_id} className="transition-colors hover:bg-muted/20">
        <td className="px-4 py-3 text-sm font-medium text-foreground">#{req.request_id}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex h-5 items-center rounded-chip border px-2 text-[11px] font-semibold ${isUnfreeze ? 'border-primary/30 bg-primary/10 text-primary' : 'border-warning/30 bg-warning/10 text-warning'}`}>
            {isUnfreeze ? 'Unfreeze' : 'Freeze'}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-foreground">{req.requester_name ?? `User #${req.requester_user_id}`}</td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          •••• {detail?.card_last_four ?? '—'}
          {detail?.cardholder_name ? <span className="ml-2 text-foreground">{detail.cardholder_name}</span> : null}
        </td>
        <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
          {formatDate(isPending ? req.created_at : req.resolved_at ?? req.created_at)}
        </td>
        <td className="px-4 py-3"><StatusBadge statusId={req.request_status_id} /></td>
        <td className="px-4 py-3 text-right">
          <Button variant="outline" className="h-7 rounded-input px-3 text-xs shadow-none" onClick={() => setSelected(req)}>
            {isPending ? 'Review' : 'View'}
          </Button>
        </td>
      </tr>
    )
  }

  return (
    <>
      <RequestList
        key={reloadToken}
        fetchPage={(params) => transactionsService.listCardFreezes(params)}
        renderRow={renderRow}
        emptyLabel="No freeze or unfreeze requests match this filter."
        columns={['#', 'Type', 'Requester', 'Card', 'Submitted', 'Status']}
      />
      <FreezeRequestDialog
        request={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => { if (!open) setSelected(null) }}
        onResolved={() => { setSelected(null); setReloadToken((t) => t + 1) }}
      />
    </>
  )
}

export default function AdminRequestsPage() {
  const [activeTab, setActiveTab] = useState('refund')

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-card-foreground sm:text-xl">Requests</h1>
        <p className="text-sm text-muted-foreground">Review and resolve refund and card-freeze requests.</p>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-card-foreground'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'refund' ? <RefundTab /> : <FreezeTab />}
    </div>
  )
}
