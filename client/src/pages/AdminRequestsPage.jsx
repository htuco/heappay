import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Toggle from '@/components/settings/Toggle'
import RefundRequestDialog from '@/components/admin/RefundRequestDialog'
import FreezeRequestDialog from '@/components/admin/FreezeRequestDialog'
import transactionsService from '@/services/transactionsService'
import { useNotifications } from '@/context/NotificationContext'
import { CATEGORIES } from '@/context/notifications/categories'
import { formatMonetaryValue } from '@/utils/transactionMeta'
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
  { key: 'rules', label: 'Approval Rules' },
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
          {(req.refund_detail?.transaction_amount != null || req.refund_detail?.transaction_amount_hidden) && (
            <span className="ml-2 font-medium text-foreground">
              {formatMonetaryValue(req.refund_detail?.transaction_amount, {
                hidden: req.refund_detail?.transaction_amount_hidden,
              })}
            </span>
          )}
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

function RulesTab() {
  const { notify } = useNotifications()
  const [enabled, setEnabled] = useState(false)
  const [autoApproveMaxAmount, setAutoApproveMaxAmount] = useState('')
  const [maxAgeDays, setMaxAgeDays] = useState('')
  const [meta, setMeta] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  function applyRules(rules) {
    setEnabled(Boolean(rules.enabled))
    setAutoApproveMaxAmount(String(rules.auto_approve_max_amount))
    setMaxAgeDays(String(rules.max_age_days))
    setMeta({ updatedAt: rules.updated_at, updatedByName: rules.updated_by_name })
  }

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    transactionsService
      .getRefundApprovalRules()
      .then((rules) => { if (!cancelled) applyRules(rules) })
      .catch(() => { if (!cancelled) setError('Failed to load refund approval rules.') })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      const rules = await transactionsService.updateRefundApprovalRules({
        enabled,
        autoApproveMaxAmount: Number(autoApproveMaxAmount),
        maxAgeDays: Number(maxAgeDays),
      })
      applyRules(rules)
      notify({
        type: 'success',
        category: CATEGORIES.ADMIN_ACTION,
        message: 'Refund approval rules updated.',
      })
    } catch (err) {
      setError(err?.message ?? 'Failed to save refund approval rules.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-surface border border-border bg-card shadow-xs">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-4 rounded-surface border border-border bg-card p-5 shadow-xs">
      <div>
        <h2 className="text-sm font-semibold text-card-foreground">Automatic refund approval</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          When enabled, pending refunds are evaluated on a schedule: small, recent ones are
          auto-approved, and refunds left pending longer than the age limit are auto-declined.
          Everything else stays pending for manual review.
        </p>
      </div>

      <Toggle
        enabled={enabled}
        label="Enable automatic approval"
        onToggle={() => setEnabled((v) => !v)}
        disabled={isSaving}
      />

      <div className="space-y-1.5">
        <label htmlFor="auto-approve-max-amount" className="text-sm font-medium text-card-foreground">
          Auto-approve refunds under ($)
        </label>
        <Input
          id="auto-approve-max-amount"
          type="number"
          min="0"
          step="0.01"
          value={autoApproveMaxAmount}
          onChange={(e) => setAutoApproveMaxAmount(e.target.value)}
          disabled={isSaving}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="max-age-days" className="text-sm font-medium text-card-foreground">
          Auto-decline if pending longer than (days)
        </label>
        <Input
          id="max-age-days"
          type="number"
          min="1"
          max="365"
          step="1"
          value={maxAgeDays}
          onChange={(e) => setMaxAgeDays(e.target.value)}
          disabled={isSaving}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted-foreground">
          {meta?.updatedAt
            ? `Last updated ${meta.updatedByName ? `by ${meta.updatedByName} · ` : ''}${formatDate(meta.updatedAt)}`
            : null}
        </p>
        <Button
          className="h-9 rounded-input px-4 text-sm shadow-none"
          disabled={isSaving}
          onClick={handleSave}
        >
          {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
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

      {activeTab === 'refund' ? <RefundTab /> : activeTab === 'freeze' ? <FreezeTab /> : <RulesTab />}
    </div>
  )
}
