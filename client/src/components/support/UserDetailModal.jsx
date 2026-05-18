import { useCallback, useEffect, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  MinusCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { blockCard, listCards, unblockCard } from '@/services/cardsService'
import transactionsService from '@/services/transactionsService'

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

const USER_STATUS = {
  1: { label: 'Active',    Icon: CheckCircle2, color: 'text-emerald-500' },
  2: { label: 'Inactive',  Icon: MinusCircle,  color: 'text-muted-foreground/50' },
  3: { label: 'Suspended', Icon: XCircle,      color: 'text-red-500' },
}

const TX_TYPE_META = {
  1: { label: 'Payment',  Icon: ArrowUpRight,  color: 'text-red-500'     },
  2: { label: 'Deposit',  Icon: ArrowDownLeft, color: 'text-emerald-500' },
  3: { label: 'Transfer', Icon: ArrowUpRight,  color: 'text-blue-500'    },
  4: { label: 'Refund',   Icon: RotateCcw,     color: 'text-amber-500'   },
}

const REQUEST_STATUS = {
  1: { label: 'Pending',  variant: 'warning'     },
  2: { label: 'Approved', variant: 'success'     },
  3: { label: 'Declined', variant: 'destructive' },
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
      {children}
    </p>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-foreground text-right">{children}</span>
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-input transition-colors ${
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      }`}
    >
      {children}
    </button>
  )
}

// ─── tabs ─────────────────────────────────────────────────────────────────────

function ProfileTab({ user, rolesById }) {
  const status = USER_STATUS[user.status_id] ?? USER_STATUS[2]
  const StatusIcon = status.Icon

  return (
    <div className="rounded-input border border-border bg-muted/20 px-4 py-3">
      <Row label="Full name">{user.first_name} {user.last_name}</Row>
      <Row label="Email">{user.email}</Row>
      <Row label="Role">
        <Badge variant="secondary">{rolesById[user.user_role_id] ?? `#${user.user_role_id}`}</Badge>
      </Row>
      <Row label="Status">
        <span className={`flex items-center gap-1.5 ${status.color}`}>
          <StatusIcon className="size-3.5" strokeWidth={1.75} />
          {status.label}
        </span>
      </Row>
      <Row label="User ID">#{user.user_id}</Row>
      {user.address && <Row label="Address">{user.address}</Row>}
    </div>
  )
}

function CardsTab({ userId }) {
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
      const updated = card.status_id === 3
        ? await unblockCard(card.card_id)
        : await blockCard(card.card_id)
      setCards((prev) => prev.map((c) => c.card_id === updated.card_id ? updated : c))
    } catch { /* ignore */ }
    finally { setPendingId(null) }
  }

  if (isLoading) return <LoadingRows />
  if (error) return <ErrorMsg>{error}</ErrorMsg>
  if (cards.length === 0) return <EmptyMsg>No cards found.</EmptyMsg>

  return (
    <div className="space-y-2">
      {cards.map((card) => {
        const blocked = card.status_id === 3
        return (
          <div key={card.card_id} className="flex items-center justify-between gap-3 rounded-input border border-border bg-card px-3 py-2.5">
            <div className="min-w-0 flex items-center gap-2">
              <CreditCard className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-medium">{card.masked_card_number}</p>
                <p className="text-xs text-muted-foreground">{card.cardholder_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={blocked ? 'destructive' : 'success'}>{blocked ? 'Blocked' : 'Active'}</Badge>
              <Button
                variant="outline"
                className="h-7 rounded-input px-2.5 text-xs shadow-none"
                disabled={pendingId === card.card_id}
                onClick={() => toggle(card)}
              >
                {pendingId === card.card_id
                  ? <Loader2 className="size-3 animate-spin" />
                  : blocked ? 'Unblock' : 'Block'
                }
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

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
      <div className="divide-y divide-border/40 rounded-input border border-border overflow-hidden">
        {data.items.map((tx) => {
          const meta = TX_TYPE_META[tx.transaction_type_id] ?? TX_TYPE_META[1]
          const TxIcon = meta.Icon
          return (
            <div key={tx.transaction_id} className="flex items-center gap-3 px-3 py-2.5 bg-card hover:bg-muted/20 transition-colors">
              <div className={`flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/50 ${meta.color}`}>
                <TxIcon className="size-3.5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">
                  {tx.sender?.full_name ?? tx.sender?.cardholder_name ?? (tx.recipient?.full_name ?? '—')}
                </p>
                <p className="text-[11px] text-muted-foreground">{fmtDate(tx.created_at)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold tabular-nums">{fmtAmount(tx.amount)}</p>
                <p className="text-[11px] text-muted-foreground">{meta.label}</p>
              </div>
            </div>
          )
        })}
      </div>
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-1.5">
            <Button variant="outline" className="h-7 rounded-input px-2.5 text-xs shadow-none" disabled={page <= 1 || isLoading} onClick={() => load(page - 1)}>Prev</Button>
            <Button variant="outline" className="h-7 rounded-input px-2.5 text-xs shadow-none" disabled={page >= totalPages || isLoading} onClick={() => load(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}

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
      <div className="divide-y divide-border/40 rounded-input border border-border overflow-hidden">
        {data.items.map((req) => {
          const statusMeta = REQUEST_STATUS[req.request_status_id] ?? REQUEST_STATUS[1]
          return (
            <div key={req.request_id} className="flex items-center gap-3 px-3 py-2.5 bg-card hover:bg-muted/20 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">
                  Tx #{req.refund_detail?.transaction_id ?? '—'}
                  {req.refund_detail?.transaction_amount
                    ? <span className="ml-1.5 font-semibold">{fmtAmount(req.refund_detail.transaction_amount)}</span>
                    : null
                  }
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {req.note ?? <span className="italic">No reason</span>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{fmt(req.created_at)}</p>
              </div>
            </div>
          )
        })}
      </div>
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-1.5">
            <Button variant="outline" className="h-7 rounded-input px-2.5 text-xs shadow-none" disabled={page <= 1 || isLoading} onClick={() => load(page - 1)}>Prev</Button>
            <Button variant="outline" className="h-7 rounded-input px-2.5 text-xs shadow-none" disabled={page >= totalPages || isLoading} onClick={() => load(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── micro helpers ────────────────────────────────────────────────────────────

function LoadingRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-input bg-muted" />
      ))}
    </div>
  )
}

function ErrorMsg({ children }) {
  return <p className="py-4 text-sm text-destructive">{children}</p>
}

function EmptyMsg({ children }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

// ─── main export ──────────────────────────────────────────────────────────────

const TABS = ['Profile', 'Cards', 'Transactions', 'Refunds']

export default function UserDetailModal({ user, open, onOpenChange, rolesById }) {
  const [activeTab, setActiveTab] = useState('Profile')

  useEffect(() => {
    if (open) setActiveTab('Profile')
  }, [open, user?.user_id])

  if (!user) return null

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-slate-950/35 backdrop-blur-[10px]"
        className="max-w-[36rem] rounded-[20px] border border-border bg-popover p-0 shadow-[0_20px_60px_rgba(15,23,42,0.18)] dark:border-white/10 [&>button]:right-5 [&>button]:top-5 [&>button]:flex [&>button]:size-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:p-0 [&>button]:opacity-60 [&>button]:hover:bg-slate-100 [&>button]:hover:opacity-100 dark:[&>button]:hover:bg-white/10"
      >
        <div className="p-6">
          <DialogHeader className="mb-4 gap-0 pr-8">
            <DialogTitle className="text-[1.1rem] font-semibold text-card-foreground">
              {user.first_name} {user.last_name}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
              {user.email}
            </DialogDescription>
          </DialogHeader>

          {/* Tab bar */}
          <div className="mb-4 flex gap-1 rounded-input bg-muted/40 p-1 border border-border/50">
            {TABS.map((tab) => (
              <TabButton key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
                {tab}
              </TabButton>
            ))}
          </div>

          {/* Tab content */}
          <div className="min-h-[200px]">
            {activeTab === 'Profile'      && <ProfileTab user={user} rolesById={rolesById} />}
            {activeTab === 'Cards'        && <CardsTab userId={user.user_id} />}
            {activeTab === 'Transactions' && <TransactionsTab userId={user.user_id} />}
            {activeTab === 'Refunds'      && <RefundsTab userId={user.user_id} />}
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
