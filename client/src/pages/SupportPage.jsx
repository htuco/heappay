import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CreditCard,
  Loader2,
  RotateCcw,
  Shield,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import RefundRequestDialog from '@/components/admin/RefundRequestDialog'
import { blockCard, listCards, unblockCard } from '@/services/cardsService'
import transactionsService from '@/services/transactionsService'
import usersService from '@/services/usersService'
import { useAppSelector } from '@/store/hooks'
import { selectCardStatuses, selectUserRoles } from '@/store/slices/referenceDataSlice'

const USERS_PAGE_SIZE = 10
const TICKETS_PAGE_SIZE = 10

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ─── User Status Badge ────────────────────────────────────────────────────────

function statusVariant(statusId) {
  if (statusId === 1) return 'success'
  if (statusId === 3) return 'destructive'
  return 'warning'
}

function statusLabel(statusId) {
  if (statusId === 1) return 'Active'
  if (statusId === 3) return 'Suspended'
  return 'Inactive'
}

// ─── Cards drawer for a single user ──────────────────────────────────────────

function UserCardsDrawer({ userId, onClose }) {
  const [cards, setCards] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingCardId, setPendingCardId] = useState(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listCards({ user_id: userId })
      setCards(data)
    } catch {
      setError('Failed to load cards.')
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => { load() }, [load])

  // Resolve status ids by name — ids are not stable across environments, and
  // "freeze" is the support action (sets the card to the 'frozen' status).
  const cardStatuses = useAppSelector(selectCardStatuses)
  const statusNameById = useMemo(
    () =>
      Object.fromEntries(
        (cardStatuses ?? []).map((s) => [s.card_status_id, s.status_name]),
      ),
    [cardStatuses],
  )

  const isFrozen = (card) => statusNameById[card.status_id] === 'frozen'

  async function toggleFreeze(card) {
    setPendingCardId(card.card_id)
    try {
      const updated = isFrozen(card)
        ? await unblockCard(card.card_id)
        : await blockCard(card.card_id)
      setCards((prev) => prev.map((c) => c.card_id === updated.card_id ? updated : c))
    } catch {
      // silently ignore; card list remains unchanged
    } finally {
      setPendingCardId(null)
    }
  }

  const cardStatusLabel = (statusId) => {
    const name = statusNameById[statusId]
    if (name) return name.charAt(0).toUpperCase() + name.slice(1)
    return statusId === 1 ? 'Active' : 'Inactive'
  }

  const cardStatusVariant = (statusId) => {
    const name = statusNameById[statusId]
    if (name === 'active') return 'success'
    if (name === 'expired' || name === 'cancelled') return 'destructive'
    if (name === 'frozen') return 'warning'
    return 'warning'
  }

  return (
    <div className="rounded-surface border border-border bg-muted/30 px-4 py-3 mt-1">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Cards</p>
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && <p className="text-xs text-destructive py-2">{error}</p>}

      {!isLoading && !error && cards.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">No cards found.</p>
      )}

      {!isLoading && !error && cards.length > 0 && (
        <div className="space-y-2">
          {cards.map((card) => (
            <div
              key={card.card_id}
              className="flex items-center justify-between gap-3 rounded-surface border border-border bg-card px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-card-foreground">{card.masked_card_number}</p>
                <p className="text-xs text-muted-foreground">{card.cardholder_name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={cardStatusVariant(card.status_id)}>{cardStatusLabel(card.status_id)}</Badge>
                <Button
                  variant="outline"
                  className="h-7 rounded-input px-2.5 text-xs shadow-none"
                  disabled={pendingCardId === card.card_id}
                  onClick={() => toggleFreeze(card)}
                >
                  {pendingCardId === card.card_id
                    ? <Loader2 className="size-3 animate-spin" />
                    : isFrozen(card) ? 'Unfreeze' : 'Freeze'
                  }
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const userRoles = useAppSelector(selectUserRoles)
  const rolesById = useMemo(
    () => Object.fromEntries((userRoles ?? []).map((r) => [r.role_id, r.role_name])),
    [userRoles],
  )

  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingUserId, setPendingUserId] = useState(null)
  const [expandedUserId, setExpandedUserId] = useState(null)
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE))

  const load = useCallback(async (p = 1, q = search) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await usersService.list({
        email: q.trim() || undefined,
        limit: USERS_PAGE_SIZE,
        offset: (p - 1) * USERS_PAGE_SIZE,
      })
      setUsers(data)
      setTotal(data.length < USERS_PAGE_SIZE && p === 1 ? data.length : (p - 1) * USERS_PAGE_SIZE + data.length)
      setPage(p)
    } catch {
      setError('Failed to load users.')
    } finally {
      setIsLoading(false)
    }
  }, [search])

  useEffect(() => { load(1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e) {
    setSearch(e.target.value)
    load(1, e.target.value)
  }

  async function toggleSuspend(user) {
    setPendingUserId(user.user_id)
    try {
      const updated = user.status_id === 3
        ? await usersService.activate(user.user_id)
        : await usersService.suspend(user.user_id)
      setUsers((prev) => prev.map((u) => u.user_id === updated.user_id ? updated : u))
    } catch {
      // silently ignore
    } finally {
      setPendingUserId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={handleSearch}
          placeholder="Search by email…"
          className="max-w-xs"
        />
        <Button
          variant="outline"
          className="h-9 rounded-input text-xs shadow-none"
          onClick={() => load(page)}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-surface border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-widest">Name</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-widest">Email</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-widest">Role</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-widest" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              : users.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )
              : users.map((user) => (
                <>
                  <tr
                    key={user.user_id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-card-foreground">
                      {user.first_name} {user.last_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-50">
                      <span className="block truncate">{user.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{rolesById[user.user_role_id] ?? user.user_role_id}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(user.status_id)}>
                        {statusLabel(user.status_id)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          className="h-7 rounded-input px-2.5 text-xs shadow-none"
                          onClick={() => setExpandedUserId(
                            expandedUserId === user.user_id ? null : user.user_id
                          )}
                        >
                          <CreditCard className="size-3 mr-1" />
                          Cards
                        </Button>
                        <Button
                          variant={user.status_id === 3 ? 'outline' : 'outline'}
                          className={`h-7 rounded-input px-2.5 text-xs shadow-none ${
                            user.status_id === 3
                              ? 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950'
                              : 'border-destructive/30 text-destructive hover:bg-destructive/5 hover:border-destructive/50'
                          }`}
                          disabled={pendingUserId === user.user_id}
                          onClick={() => toggleSuspend(user)}
                        >
                          {pendingUserId === user.user_id
                            ? <Loader2 className="size-3 animate-spin" />
                            : user.status_id === 3 ? 'Activate' : 'Suspend'
                          }
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expandedUserId === user.user_id && (
                    <tr key={`${user.user_id}-cards`}>
                      <td colSpan={5} className="px-4 pb-3">
                        <UserCardsDrawer
                          userId={user.user_id}
                          onClose={() => setExpandedUserId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))
            }
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-input text-xs shadow-none"
            disabled={page <= 1 || isLoading}
            onClick={() => load(page - 1)}
          >
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-input text-xs shadow-none"
            disabled={page >= totalPages || isLoading}
            onClick={() => load(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Tickets Tab ──────────────────────────────────────────────────────────────

function TicketsTab() {
  const [requests, setRequests] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const totalPages = Math.max(1, Math.ceil(total / TICKETS_PAGE_SIZE))

  const load = useCallback(async (p = 1) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await transactionsService.listPendingRefunds({ page: p, pageSize: TICKETS_PAGE_SIZE })
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {total > 0 && (
            <Badge variant="warning" className="text-xs">{total} pending</Badge>
          )}
        </div>
        <Button
          variant="outline"
          className="h-8 rounded-input text-xs shadow-none"
          onClick={() => load(page)}
          disabled={isLoading}
        >
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-surface border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-widest">Request</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-widest">Transaction</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-widest">Reason</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-widest">Submitted</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-widest" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              : requests.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No pending refund requests.
                  </td>
                </tr>
              )
              : requests.map((req) => (
                <tr key={req.request_id} className="group hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-card-foreground">#{req.request_id}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    #{req.refund_detail?.transaction_id ?? '—'}
                  </td>
                  <td className="px-4 py-3 max-w-50">
                    <span className="block truncate text-card-foreground" title={req.note ?? ''}>
                      {req.note ?? <span className="text-muted-foreground italic">No reason</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(req.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      className="h-7 rounded-input px-3 text-xs shadow-none opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setSelectedRequest(req)}
                    >
                      Review
                    </Button>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-input text-xs shadow-none"
            disabled={page <= 1 || isLoading}
            onClick={() => load(page - 1)}
          >
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-input text-xs shadow-none"
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
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'tickets', label: 'Tickets', icon: RotateCcw },
]

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-input bg-primary/10 text-primary">
          <Shield className="size-5" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Support Portal</h1>
          <p className="text-xs text-muted-foreground">Manage users, cards, and refund requests</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-input bg-muted/50 p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-input px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-card text-card-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="size-4" strokeWidth={2} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="rounded-panel border border-border bg-card p-5 shadow-sm">
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'tickets' && <TicketsTab />}
      </div>
    </div>
  )
}
