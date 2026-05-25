import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardBrandIcon } from '@/components/ui/CardBrandIcon'
import {
  DialogContent,
  DialogRoot,
} from '@/components/ui/dialog'
import { blockCard, listCards, unblockCard } from '@/services/cardsService'
import transactionsService from '@/services/transactionsService'
import usersService from '@/services/usersService'
import { useAppSelector } from '@/store/hooks'
import { selectCardTypes } from '@/store/slices/referenceDataSlice'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtAmount(v) {
  const n = Number.parseFloat(v ?? '0')
  if (Number.isNaN(n)) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function initials(user) {
  const f = user?.first_name?.[0] ?? ''
  const l = user?.last_name?.[0] ?? ''
  return (f + l).toUpperCase() || '?'
}

const USER_STATUS = {
  1: { label: 'Active',    dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  2: { label: 'Inactive',  dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
  3: { label: 'Suspended', dot: 'bg-destructive',  text: 'text-destructive' },
}

const TX_TYPE_META = {
  1: { label: 'Payment',  Icon: ArrowUpRight,  bg: 'bg-destructive/10',  color: 'text-destructive'  },
  2: { label: 'Deposit',  Icon: ArrowDownLeft, bg: 'bg-success/10',      color: 'text-success'      },
  3: { label: 'Transfer', Icon: ArrowUpRight,  bg: 'bg-primary/10',      color: 'text-primary'      },
  4: { label: 'Refund',   Icon: RotateCcw,     bg: 'bg-warning/10',      color: 'text-warning'      },
}

const TX_STATUS = {
  1: { label: 'Pending',   variant: 'warning'     },
  2: { label: 'Completed', variant: 'success'     },
  3: { label: 'Failed',    variant: 'error'       },
  4: { label: 'Reversed',  variant: 'secondary'   },
}

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

  async function toggle(card) {
    setPendingId(card.card_id)
    try {
      const updated = card.status_id === 2
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
      <div className="grid grid-cols-[1fr_88px_88px_88px] gap-4 border-b border-border bg-muted/30 px-4 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Card</span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Type</span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</span>
        <span />
      </div>
      <div className="divide-y divide-border/60">
        {cards.map((card) => {
          const blocked = card.status_id === 2
          const type = typesById[card.card_type_id]
          return (
            <div key={card.card_id} className="grid grid-cols-[1fr_88px_88px_88px] items-center gap-4 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <CardBrandIcon brand={type?.vendor} width={42} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground font-mono">{card.masked_card_number}</p>
                  <p className="text-xs text-muted-foreground truncate">{card.cardholder_name}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground capitalize">{type?.type_name ?? '—'}</span>
              <Badge variant={blocked ? 'error' : 'success'} className="w-fit">
                {blocked ? 'Blocked' : 'Active'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-full rounded-input text-xs shadow-none"
                disabled={pendingId === card.card_id}
                onClick={() => toggle(card)}
              >
                {pendingId === card.card_id
                  ? <Loader2 className="size-3 animate-spin" />
                  : blocked ? 'Unblock' : 'Block'
                }
              </Button>
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

  const load = useCallback(async (p) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await transactionsService.listForUser(userId, { page: p, pageSize: 8 })
      setData(result)
      setPage(p)
    } catch {
      setError('Failed to load transactions.')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => { load(1) }, [load])

  if (isLoading && !data) return <LoadingRows />
  if (error) return <ErrorMsg>{error}</ErrorMsg>
  if (!data || data.items.length === 0) return <EmptyMsg>No transactions found.</EmptyMsg>

  const totalPages = Math.ceil(data.total / 8)

  return (
    <div>
      <div className="rounded-input border border-border overflow-hidden">
        <div className="grid grid-cols-[28px_1fr_72px_88px_80px] gap-3 border-b border-border bg-muted/30 px-4 py-2">
          <span />
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Counterparty</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Type</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-right">Amount</span>
        </div>
        <div className="divide-y divide-border/60">
          {data.items.map((tx) => {
            const meta = TX_TYPE_META[tx.transaction_type_id] ?? TX_TYPE_META[1]
            const TxIcon = meta.Icon
            const statusMeta = TX_STATUS[tx.status_id] ?? TX_STATUS[1]
            const counterparty = tx.sender?.full_name ?? tx.sender?.cardholder_name ?? tx.recipient?.full_name ?? '—'
            return (
              <div key={tx.transaction_id} className="grid grid-cols-[28px_1fr_72px_88px_80px] items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
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
        <div className="grid grid-cols-[1fr_100px_80px_88px] gap-3 border-b border-border bg-muted/30 px-4 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Transaction</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Amount</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Date</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</span>
        </div>
        <div className="divide-y divide-border/60">
          {data.items.map((req) => {
            const statusMeta = REQUEST_STATUS[req.request_status_id] ?? REQUEST_STATUS[1]
            return (
              <div key={req.request_id} className="grid grid-cols-[1fr_100px_80px_88px] items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm text-foreground font-mono">Tx #{req.refund_detail?.transaction_id ?? '—'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{req.note ?? <span className="italic">No reason provided</span>}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-foreground">{fmtAmount(req.refund_detail?.transaction_amount)}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(req.created_at)}</p>
                <Badge variant={statusMeta.variant} className="w-fit text-[11px]">{statusMeta.label}</Badge>
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
        className="max-w-195 w-full rounded-input border border-border bg-popover p-0 shadow-lg data-[state=open]:ease-[cubic-bezier(0.34,1.56,0.64,1)] data-[state=open]:zoom-in-50 data-[state=open]:slide-in-from-bottom-16 [&>button]:right-5 [&>button]:top-5 [&>button]:flex [&>button]:size-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-input [&>button]:p-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted [&>button]:hover:text-foreground [&>button]:transition-colors"
      >
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-border px-6 py-5 pr-16">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
            {initials(user)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground leading-tight">
              {user.first_name} {user.last_name}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground truncate">{user.email}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
              className="h-7 rounded-input px-3 text-xs shadow-none"
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
        <div className="h-150 overflow-y-auto p-6">
          {activeTab === 'Profile'      && <ProfileTab user={user} rolesById={rolesById} />}
          {activeTab === 'Cards'        && <CardsTab userId={user.user_id} />}
          {activeTab === 'Transactions' && <TransactionsTab userId={user.user_id} />}
          {activeTab === 'Refunds'      && <RefundsTab userId={user.user_id} />}
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
