import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import CardBrandIcon from '@/components/ui/CardBrandIcon'
import {
  DialogContent,
  DialogRoot,
} from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import UserAvatar from '@/components/ui/UserAvatar'
import { blockCard, listCards, unblockCard } from '@/services/cardsService'
import transactionsService from '@/services/transactionsService'
import usersService from '@/services/usersService'
import { useAppSelector } from '@/store/hooks'
import { selectCardStatuses, selectCardTypes } from '@/store/slices/referenceDataSlice'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtAmount(v) {
  const n = Number.parseFloat(v ?? '0')
  if (Number.isNaN(n)) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const USER_STATUS = {
  1: { label: 'Active',    dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  2: { label: 'Inactive',  dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
  3: { label: 'Suspended', dot: 'bg-destructive',  text: 'text-destructive' },
}

const TX_TYPE_META = {
  1: { label: 'Deposit',    Icon: ArrowDownLeft, bg: 'bg-success/10',      color: 'text-success'      },
  2: { label: 'Payment',    Icon: ArrowUpRight,  bg: 'bg-destructive/10',  color: 'text-destructive'  },
  3: { label: 'Refund',     Icon: RotateCcw,     bg: 'bg-warning/10',      color: 'text-warning'      },
  4: { label: 'Withdrawal', Icon: ArrowUpRight,  bg: 'bg-primary/10',      color: 'text-primary'      },
  5: { label: 'Chargeback', Icon: RotateCcw,     bg: 'bg-destructive/10',  color: 'text-destructive'  },
}

const TX_STATUS = {
  1: { label: 'Pending',   variant: 'warning'     },
  2: { label: 'Completed', variant: 'success'     },
  3: { label: 'Rejected',  variant: 'error'       },
  4: { label: 'Reversed',  variant: 'secondary'   },
}

const TX_STATUS_OPTIONS = [
  { value: '1', label: 'Pending' },
  { value: '2', label: 'Completed' },
  { value: '3', label: 'Rejected' },
  { value: '4', label: 'Reversed' },
]

const TX_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...TX_STATUS_OPTIONS,
]

const TX_TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  ...Object.entries(TX_TYPE_META).map(([value, meta]) => ({ value, label: meta.label })),
]

const TX_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'amount_desc', label: 'Amount high' },
  { value: 'amount_asc', label: 'Amount low' },
]

const REQUEST_STATUS = {
  1: { label: 'Pending',  variant: 'warning'     },
  2: { label: 'Approved', variant: 'success'     },
  3: { label: 'Declined', variant: 'error'       },
}

const TABS = ['Profile', 'Cards', 'Transactions', 'Refunds']

// ─── shared micro components ──────────────────────────────────────────────────

function LoadingRows() {
  return (
    <div className="space-y-2 pt-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-input bg-muted" />
      ))}
    </div>
  )
}

function ErrorMsg({ children }) {
  return <p className="py-6 text-sm text-destructive">{children}</p>
}

function EmptyMsg({ children }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

function Pagination({ page, totalPages, isLoading, onPrev, onNext }) {
  if (totalPages <= 1) return null
  return (
    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
      <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
      <div className="flex gap-1.5">
        <Button variant="outline" className="h-7 rounded-input px-2.5 text-xs shadow-none" disabled={page <= 1 || isLoading} onClick={onPrev}>Prev</Button>
        <Button variant="outline" className="h-7 rounded-input px-2.5 text-xs shadow-none" disabled={page >= totalPages || isLoading} onClick={onNext}>Next</Button>
      </div>
    </div>
  )
}

// ─── profile tab ──────────────────────────────────────────────────────────────

function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 py-2.5 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground pt-0.5">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  )
}

function ProfileTab({ user, rolesById }) {
  const status = USER_STATUS[user.status_id] ?? USER_STATUS[2]

  return (
    <div className="rounded-input border border-border bg-muted/20 px-5 py-1">
      <DetailRow label="Full name">{user.first_name} {user.last_name}</DetailRow>
      <DetailRow label="Email">
        <span className="font-mono text-xs text-foreground/80">{user.email}</span>
      </DetailRow>
      <DetailRow label="Role">
        <Badge variant="secondary" className="capitalize">
          {rolesById[user.user_role_id] ?? `#${user.user_role_id}`}
        </Badge>
      </DetailRow>
      <DetailRow label="Status">
        <span className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${status.dot}`} />
          <span className={`text-sm ${status.text}`}>{status.label}</span>
        </span>
      </DetailRow>
      <DetailRow label="User ID">
        <span className="font-mono text-xs text-muted-foreground">#{user.user_id}</span>
      </DetailRow>
      {user.address && <DetailRow label="Address">{user.address}</DetailRow>}
    </div>
  )
}

// ─── cards tab ────────────────────────────────────────────────────────────────

function CardsTab({ userId }) {
  const cardTypes = useAppSelector(selectCardTypes)
  const typesById = useMemo(
    () => Object.fromEntries((cardTypes ?? []).map((t) => [t.card_type_id, t])),
    [cardTypes],
  )
  // Resolve the frozen status by name — ids are not stable across environments,
  // and "freeze" is the support action that sets a card to the 'frozen' status.
  const cardStatuses = useAppSelector(selectCardStatuses)
  const statusNameById = useMemo(
    () =>
      Object.fromEntries(
        (cardStatuses ?? []).map((s) => [s.card_status_id, s.status_name]),
      ),
    [cardStatuses],
  )
  const [cards, setCards] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    listCards({ user_id: userId })
      .then(setCards)
      .catch(() => setError('Failed to load cards.'))
      .finally(() => setIsLoading(false))
  }, [userId])

  const isCardFrozen = (card) => statusNameById[card.status_id] === 'frozen'

  async function toggle(card) {
    setPendingId(card.card_id)
    try {
      const updated = isCardFrozen(card)
        ? await unblockCard(card.card_id)
        : await blockCard(card.card_id)
      setCards((prev) => prev.map((c) => c.card_id === updated.card_id ? updated : c))
    } catch { /* ignore */ }
    finally { setPendingId(null) }
  }

  if (isLoading) return <LoadingRows />
  if (error) return <ErrorMsg>{error}</ErrorMsg>
  if (cards.length === 0) return <EmptyMsg>No cards on this account.</EmptyMsg>

  return (
    <div className="rounded-input border border-border overflow-hidden">
      <div className="hidden grid-cols-[1fr_88px_88px_88px] gap-4 border-b border-border bg-muted/30 px-4 py-2.5 sm:grid">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Card</span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Type</span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</span>
        <span />
      </div>
      <div className="divide-y divide-border/60">
        {cards.map((card) => {
          const frozen = isCardFrozen(card)
          const type = typesById[card.card_type_id]
          return (
            <div
              key={card.card_id}
              className="flex flex-col gap-3 px-4 py-3 sm:grid sm:grid-cols-[1fr_88px_88px_88px] sm:items-center sm:gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <CardBrandIcon brand={type?.vendor} width={42} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground font-mono">{card.masked_card_number}</p>
                  <p className="text-xs text-muted-foreground truncate">{card.cardholder_name}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:contents">
                <span className="text-xs text-muted-foreground capitalize">{type?.type_name ?? '—'}</span>
                <Badge variant={frozen ? 'warning' : 'success'} className="w-fit">
                  {frozen ? 'Frozen' : 'Active'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-input px-3 text-xs shadow-none touch-manipulation sm:h-7 sm:w-full"
                  disabled={pendingId === card.card_id}
                  onClick={() => toggle(card)}
                >
                  {pendingId === card.card_id
                    ? <Loader2 className="size-3 animate-spin" />
                    : frozen ? 'Unfreeze' : 'Freeze'
                  }
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── transactions tab ─────────────────────────────────────────────────────────

function TransactionsTab({ userId }) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [pendingTransactionId, setPendingTransactionId] = useState(null)

  const queryParams = useMemo(() => ({
    pageSize: 8,
    statusId: statusFilter === 'all' ? undefined : Number(statusFilter),
    transactionTypeId: typeFilter === 'all' ? undefined : Number(typeFilter),
    sort,
  }), [sort, statusFilter, typeFilter])

  const load = useCallback(async (p) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await transactionsService.listForUser(userId, { ...queryParams, page: p })
      setData(result)
      setPage(p)
    } catch {
      setError('Failed to load transactions.')
    } finally {
      setIsLoading(false)
    }
  }, [queryParams, userId])

  useEffect(() => { load(1) }, [load])

  async function updateStatus(tx, statusValue) {
    const nextStatusId = Number(statusValue)
    if (!Number.isFinite(nextStatusId) || tx.status_id === nextStatusId) return

    setPendingTransactionId(tx.transaction_id)
    setActionError(null)
    try {
      const updated = await transactionsService.patchAsStaff(tx.transaction_id, {
        status_id: nextStatusId,
      })
      if (statusFilter !== 'all' && Number(statusFilter) !== nextStatusId) {
        await load(page)
      } else {
        setData((prev) => prev
          ? {
              ...prev,
              items: prev.items.map((item) => (
                item.transaction_id === updated.transaction_id ? updated : item
              )),
            }
          : prev)
      }
    } catch (err) {
      setActionError(err?.message ?? 'Failed to update transaction status.')
    } finally {
      setPendingTransactionId(null)
    }
  }

  if (isLoading && !data) return <LoadingRows />
  if (error) return <ErrorMsg>{error}</ErrorMsg>

  const items = data?.items ?? []
  const totalPages = Math.ceil((data?.total ?? 0) / 8)

  return (
    <div>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select
          aria-label="Filter transactions by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          options={TX_STATUS_FILTER_OPTIONS}
          className="h-9 border border-border bg-background px-2 py-1 text-xs shadow-none sm:h-8"
        />
        <Select
          aria-label="Filter transactions by type"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          options={TX_TYPE_OPTIONS}
          className="h-9 border border-border bg-background px-2 py-1 text-xs shadow-none sm:h-8"
        />
        <Select
          aria-label="Sort transactions"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          options={TX_SORT_OPTIONS}
          className="h-9 border border-border bg-background px-2 py-1 text-xs shadow-none sm:h-8"
        />
      </div>
      {actionError && (
        <p className="mb-3 rounded-input border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {actionError}
        </p>
      )}
      <div className="rounded-input border border-border overflow-hidden">
        <div className="hidden grid-cols-[28px_minmax(0,1fr)_78px_110px_90px_118px] gap-3 border-b border-border bg-muted/30 px-4 py-2 sm:grid">
          <span />
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Counterparty</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Type</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-right">Amount</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Set Status</span>
        </div>
        <div className="divide-y divide-border/60">
          {items.length === 0 ? (
            <EmptyMsg>No transactions found.</EmptyMsg>
          ) : items.map((tx) => {
            const meta = TX_TYPE_META[tx.transaction_type_id] ?? TX_TYPE_META[1]
            const TxIcon = meta.Icon
            const statusMeta = TX_STATUS[tx.status_id] ?? TX_STATUS[1]
            const isPendingStatusUpdate = pendingTransactionId === tx.transaction_id
            const counterparty = tx.sender?.full_name ?? tx.sender?.cardholder_name ?? tx.recipient?.full_name ?? '—'
            return (
              <div key={tx.transaction_id} className="px-4 py-2.5 transition-colors hover:bg-muted/30">
                {/* Mobile — stacked card */}
                <div className="flex flex-col gap-2.5 sm:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`flex size-7 shrink-0 items-center justify-center rounded-input ${meta.bg}`}>
                        <TxIcon className={`size-3.5 ${meta.color}`} strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">{counterparty}</p>
                        <p className="text-[11px] text-muted-foreground">{fmtDate(tx.created_at)}</p>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{fmtAmount(tx.amount)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pl-10">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{meta.label}</span>
                      <Badge variant={statusMeta.variant} className="w-fit text-[11px]">{statusMeta.label}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isPendingStatusUpdate && <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />}
                      <Select
                        aria-label="Set transaction status"
                        value={String(tx.status_id)}
                        onChange={(event) => updateStatus(tx, event.target.value)}
                        options={TX_STATUS_OPTIONS}
                        disabled={isPendingStatusUpdate}
                        className="h-9 border border-border bg-background px-2 py-1 text-xs shadow-none touch-manipulation"
                      />
                    </div>
                  </div>
                </div>

                {/* Desktop — grid row */}
                <div className="hidden grid-cols-[28px_minmax(0,1fr)_78px_110px_90px_118px] items-center gap-3 sm:grid">
                  <div className={`flex size-7 shrink-0 items-center justify-center rounded-input ${meta.bg}`}>
                    <TxIcon className={`size-3.5 ${meta.color}`} strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{counterparty}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtDate(tx.created_at)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{meta.label}</span>
                  <Badge variant={statusMeta.variant} className="w-fit text-[11px]">{statusMeta.label}</Badge>
                  <p className="text-right text-sm font-semibold tabular-nums text-foreground">{fmtAmount(tx.amount)}</p>
                  <div className="flex items-center gap-1.5">
                    {isPendingStatusUpdate && <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />}
                    <Select
                      aria-label="Set transaction status"
                      value={String(tx.status_id)}
                      onChange={(event) => updateStatus(tx, event.target.value)}
                      options={TX_STATUS_OPTIONS}
                      disabled={isPendingStatusUpdate}
                      className="h-8 border border-border bg-background px-2 py-1 text-xs shadow-none"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <Pagination page={page} totalPages={totalPages} isLoading={isLoading} onPrev={() => load(page - 1)} onNext={() => load(page + 1)} />
    </div>
  )
}

// ─── refunds tab ──────────────────────────────────────────────────────────────

function RefundsTab({ userId }) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (p) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await transactionsService.listRefundsForUser(userId, { page: p, pageSize: 8 })
      setData(result)
      setPage(p)
    } catch {
      setError('Failed to load refund requests.')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => { load(1) }, [load])

  if (isLoading && !data) return <LoadingRows />
  if (error) return <ErrorMsg>{error}</ErrorMsg>
  if (!data || data.items.length === 0) return <EmptyMsg>No refund requests found.</EmptyMsg>

  const totalPages = Math.ceil(data.total / 8)

  return (
    <div>
      <div className="rounded-input border border-border overflow-hidden">
        <div className="hidden grid-cols-[1fr_100px_80px_88px] gap-3 border-b border-border bg-muted/30 px-4 py-2 sm:grid">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Transaction</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Amount</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Date</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</span>
        </div>
        <div className="divide-y divide-border/60">
          {data.items.map((req) => {
            const statusMeta = REQUEST_STATUS[req.request_status_id] ?? REQUEST_STATUS[1]
            return (
              <div
                key={req.request_id}
                className="flex flex-col gap-2 px-4 py-2.5 transition-colors hover:bg-muted/30 sm:grid sm:grid-cols-[1fr_100px_80px_88px] sm:items-center sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground font-mono">Tx #{req.refund_detail?.transaction_id ?? '—'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{req.note ?? <span className="italic">No reason provided</span>}</p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:contents">
                  <p className="text-sm font-semibold tabular-nums text-foreground">{fmtAmount(req.refund_detail?.transaction_amount)}</p>
                  <p className="text-xs text-muted-foreground sm:whitespace-nowrap">{fmtDate(req.created_at)}</p>
                  <Badge variant={statusMeta.variant} className="w-fit text-[11px]">{statusMeta.label}</Badge>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <Pagination page={page} totalPages={totalPages} isLoading={isLoading} onPrev={() => load(page - 1)} onNext={() => load(page + 1)} />
    </div>
  )
}

// ─── main export ──────────────────────────────────────────────────────────────

export default function UserDetailModal({ user, open, onOpenChange, rolesById, onUserUpdated }) {
  const [activeTab, setActiveTab] = useState('Profile')
  const [isToggling, setIsToggling] = useState(false)

  useEffect(() => {
    if (open) setActiveTab('Profile')
  }, [open, user?.user_id])

  async function toggleSuspend() {
    if (!user || isToggling) return
    setIsToggling(true)
    try {
      const updated = user.status_id === 3
        ? await usersService.activate(user.user_id)
        : await usersService.suspend(user.user_id)
      onUserUpdated?.(updated)
    } catch { /* ignore */ }
    finally { setIsToggling(false) }
  }

  if (!user) return null

  const status = USER_STATUS[user.status_id] ?? USER_STATUS[2]
  const isSuspended = user.status_id === 3

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ '--tw-duration': '500ms' }}
        closeButtonClassName="size-11 sm:size-8 rounded-input p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
        className="max-w-195 w-full rounded-input border border-border bg-popover p-0 shadow-lg data-[state=open]:ease-[cubic-bezier(0.34,1.56,0.64,1)] data-[state=open]:zoom-in-50 data-[state=open]:slide-in-from-bottom-16"
      >
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 pr-14 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-5 sm:pr-16">
          <div className="flex min-w-0 items-center gap-3 sm:contents">
            <UserAvatar
              user={user}
              className="size-11 text-sm ring-1 ring-border"
              textClassName="text-sm"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-foreground leading-tight">
                {user.first_name} {user.last_name}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <Badge variant="secondary" className="capitalize text-xs">
              {rolesById[user.user_role_id] ?? `#${user.user_role_id}`}
            </Badge>
            <span className="flex items-center gap-1.5 rounded-input border border-border bg-muted/50 px-2.5 py-1">
              <span className={`size-1.5 rounded-full ${status.dot}`} />
              <span className={`text-xs font-medium ${status.text}`}>{status.label}</span>
            </span>
            <Button
              variant={isSuspended ? 'outline' : 'destructive'}
              size="sm"
              className="ml-auto h-9 rounded-input px-3 text-xs shadow-none touch-manipulation sm:ml-0 sm:h-7"
              disabled={isToggling}
              onClick={toggleSuspend}
            >
              {isToggling
                ? <Loader2 className="size-3 animate-spin" />
                : isSuspended ? 'Activate' : 'Suspend'
              }
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border px-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-1 py-3 mr-6 text-sm font-medium transition-colors last:mr-0 ${
                activeTab === tab
                  ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="h-[55vh] overflow-y-auto p-4 sm:h-150 sm:p-6">
          {activeTab === 'Profile'      && <ProfileTab user={user} rolesById={rolesById} />}
          {activeTab === 'Cards'        && <CardsTab userId={user.user_id} />}
          {activeTab === 'Transactions' && <TransactionsTab userId={user.user_id} />}
          {activeTab === 'Refunds'      && <RefundsTab userId={user.user_id} />}
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
