import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  KeyRound,
  Loader2,
  Mail,
  Snowflake,
  Sun,
  Trash2,
  User,
  UserMinus,
} from 'lucide-react'

import SplitModal, { SplitModalContextLabel } from '@/components/ui/SplitModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import CardBrandIcon from '@/components/ui/CardBrandIcon'
import { titleCase } from '@/utils/admin.utils'
import transactionsService from '@/services/transactionsService'
import { TX_STATUS_META, TX_TYPE_META } from '@/utils/transactionMeta'
import { REQUEST_STATUS_META, REQUEST_STATUS_IDS } from '@/utils/requestStatus'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'

const TABS = [
  { key: 'cards', label: 'Cards' },
  { key: 'activity', label: 'Activity' },
  { key: 'transactions', label: 'Transactions' },
]

function initialsFor(name) {
  return (
    String(name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U'
  )
}

function isFrozen(item) {
  // A frozen card carries the real 'frozen' status name (cardApiAdapter exposes
  // it as item.card.status). The backend freeze action sets this status by name.
  return item.card.status === 'frozen'
}

function roleBadgeClass(role) {
  const styles = {
    admin: 'border-primary/30 bg-primary/10 text-primary',
    support: 'border-warning/30 bg-warning/10 text-warning',
  }
  return styles[role] ?? 'border-border bg-muted/50 text-muted-foreground'
}

function StatTile({ icon, label, value, tone = 'text-muted-foreground' }) {
  const TileIcon = icon
  return (
    <div className="flex items-center gap-2.5 rounded-input border border-border bg-background/60 p-3">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-input bg-muted/60 ${tone}`}>
        <TileIcon className="size-4" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</p>
        <p className="text-base font-bold leading-tight tabular-nums text-card-foreground">{value}</p>
      </div>
    </div>
  )
}

function IconSelect({ icon, value, onChange, options, disabled }) {
  const LeadingIcon = icon
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground">
        <LeadingIcon className="size-4" strokeWidth={2} aria-hidden />
      </span>
      <Select
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
        className="h-9 pl-9 pr-9 text-sm shadow-none"
      />
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70"
        aria-hidden
      />
    </div>
  )
}

function CardStatusPill({ item }) {
  if (isFrozen(item)) {
    return <Badge variant="warning" className="text-[11px]">Frozen</Badge>
  }
  if (item.card.isActive) {
    return <Badge variant="success" className="text-[11px]">Active</Badge>
  }
  return <Badge variant="secondary" className="text-[11px] capitalize">{item.card.statusName || 'Inactive'}</Badge>
}

function CardRow({ item, canManageCards, onFreeze, onUnfreeze, pending }) {
  const frozen = isFrozen(item)
  const last4 = item.card.cardNumber?.slice(-4) ?? '••••'

  return (
    <article className="flex flex-col gap-3 rounded-surface border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0">
          <CardBrandIcon brand={item.card.brand} cardNumber={item.card.cardNumber} width={40} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-card-foreground">
            {item.card.brand?.toUpperCase() || 'Card'} •••• {last4}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Expires {item.card.expiryDate}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <CardStatusPill item={item} />
        {canManageCards ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-input px-2.5 text-xs shadow-none"
            disabled={pending}
            onClick={() => (frozen ? onUnfreeze(item.rawId) : onFreeze(item.rawId))}
          >
            {frozen ? <Sun className="size-3.5" aria-hidden /> : <Snowflake className="size-3.5" aria-hidden />}
            {frozen ? 'Unfreeze' : 'Freeze'}
          </Button>
        ) : null}
      </div>
    </article>
  )
}

function EmptyTab({ message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-surface border border-dashed border-border bg-background/50 px-4 py-12 text-center">
      <Activity className="size-5 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function TabLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Loading…
    </div>
  )
}

function formatTxDate(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function txPartyLabel(party, fallback) {
  if (!party) return fallback
  return (
    party.full_name ||
    [party.first_name, party.last_name].filter(Boolean).join(' ') ||
    party.cardholder_name ||
    fallback
  )
}

function TransactionRow({ tx }) {
  const { formatMoney } = useDisplayCurrency()
  const typeMeta = TX_TYPE_META[tx.transaction_type_id] ?? TX_TYPE_META[1]
  const statusMeta = TX_STATUS_META[tx.status_id] ?? TX_STATUS_META[1]
  const TypeIcon = typeMeta.Icon
  const sender = txPartyLabel(tx.sender, 'External')
  const recipient = txPartyLabel(tx.recipient, 'Unknown')

  return (
    <div className="flex items-center gap-3 rounded-surface border border-border bg-card px-3 py-2.5">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-input ${typeMeta.bg}`}>
        <TypeIcon className={`size-4 ${typeMeta.color}`} strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-card-foreground">
          {sender} <span className="text-muted-foreground/60">→</span> {recipient}
        </p>
        <p className="text-xs text-muted-foreground">
          {typeMeta.label} · {formatTxDate(tx.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-semibold tabular-nums text-card-foreground">
          {formatMoney(tx.amount, { hidden: tx.amount_hidden })}
        </span>
        <Badge variant={statusMeta.variant} className="text-[10px]">{statusMeta.label}</Badge>
      </div>
    </div>
  )
}

function ActivityRow({ req }) {
  const { formatMoney } = useDisplayCurrency()
  const meta = REQUEST_STATUS_META[req.request_status_id] ?? REQUEST_STATUS_META[REQUEST_STATUS_IDS.pending]
  const detail = req.refund_detail
  const amountHidden = Boolean(detail?.transaction_amount_hidden)
  const amount = detail?.transaction_amount
  return (
    <div className="flex items-center gap-3 rounded-surface border border-border bg-card px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-card-foreground">
          Refund request #{req.request_id}
          {req.refund_detail?.transaction_id ? (
            <span className="text-muted-foreground"> · tx #{req.refund_detail.transaction_id}</span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatTxDate(req.resolved_at ?? req.created_at)}
          {req.note ? ` · ${req.note}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {amount != null || amountHidden ? (
          <span className="text-sm font-semibold tabular-nums text-card-foreground">
            {formatMoney(amount, { hidden: amountHidden })}
          </span>
        ) : null}
        <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
      </div>
    </div>
  )
}

export default function UserDetailsDialog({
  selectedUser,
  setSelectedUser,
  userRoles,
  onSave,
  onCardBlock,
  onCardUnblock,
  onSuspend,
  onActivate,
  onDelete,
  isAdmin,
  // Card freeze/unfreeze is a staff-level action (block/unblock is gated by
  // require_staff on the API), so it stays available to support. Defaults to
  // isAdmin to keep admin behavior unchanged for callers that don't pass it.
  canManageCards = isAdmin,
}) {
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [activeTab, setActiveTab] = useState('cards')
  const [isSaving, setIsSaving] = useState(false)
  const [pendingCardId, setPendingCardId] = useState(null)
  const [statusAction, setStatusAction] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const [trackedUserId, setTrackedUserId] = useState(null)
  const [transactions, setTransactions] = useState(null)
  const [activity, setActivity] = useState(null)
  const [isTabLoading, setIsTabLoading] = useState(false)
  const [tabError, setTabError] = useState('')
  const [emailCopied, setEmailCopied] = useState(false)

  function copyEmail() {
    const email = selectedUser?.email
    if (!email) return
    navigator.clipboard?.writeText(email).then(
      () => {
        setEmailCopied(true)
        setTimeout(() => setEmailCopied(false), 1500)
      },
      () => {},
    )
  }

  // Reset the form when a different user is opened — done during render
  // (React's recommended pattern) rather than in an effect.
  const currentUserId = selectedUser?.id ?? null
  if (currentUserId !== trackedUserId) {
    setTrackedUserId(currentUserId)
    setSelectedRoleId(String(selectedUser?.roleId ?? ''))
    setActiveTab('cards')
    setConfirmDelete(false)
    setError('')
    setTransactions(null)
    setActivity(null)
    setTabError('')
  }

  // Lazy-load the Transactions / Activity tabs the first time each is opened
  // for the current user. Cards come from the already-loaded admin data.
  // setState lives in these callbacks (not the effect body) to match the
  // codebase's async-fetch pattern.
  const loadTransactions = useCallback(async (userId) => {
    setIsTabLoading(true)
    setTabError('')
    try {
      const res = await transactionsService.listForUser(userId, { page: 1, pageSize: 25 })
      setTransactions(res.items ?? [])
    } catch {
      setTabError('Could not load transactions.')
    } finally {
      setIsTabLoading(false)
    }
  }, [])

  const loadActivity = useCallback(async (userId) => {
    setIsTabLoading(true)
    setTabError('')
    try {
      const res = await transactionsService.listRefundsForUser(userId, { page: 1, pageSize: 25 })
      setActivity(res.items ?? [])
    } catch {
      setTabError('Could not load activity.')
    } finally {
      setIsTabLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!currentUserId) return
    if (activeTab === 'transactions' && transactions === null) loadTransactions(currentUserId)
    if (activeTab === 'activity' && activity === null) loadActivity(currentUserId)
  }, [currentUserId, activeTab, transactions, activity, loadTransactions, loadActivity])

  const cards = useMemo(() => selectedUser?.cards ?? [], [selectedUser])
  const stats = useMemo(() => {
    const total = cards.length
    const active = cards.filter((item) => item.card.isActive && !isFrozen(item)).length
    const frozen = cards.filter((item) => isFrozen(item)).length
    return { total, active, frozen }
  }, [cards])

  const roleOptions = userRoles.map((r) => ({ value: String(r.role_id), label: titleCase(r.role_name) }))
  const isSuspended = selectedUser?.status === 'suspended' || selectedUser?.status === 'inactive'
  // "Save changes" only persists the role, so it's meaningful only when the
  // selected role differs from the user's current one.
  const isRoleDirty = String(selectedRoleId) !== String(selectedUser?.roleId ?? '')

  async function runAction(fn, arg, onError) {
    setError('')
    try {
      await fn(arg)
    } catch (err) {
      onError(err?.message || 'Action failed.')
    }
  }

  async function handleSave() {
    setIsSaving(true)
    setError('')
    try {
      await onSave(selectedUser.id, {
        user_role_id: Number(selectedRoleId),
      })
    } catch (err) {
      setError(err?.message || 'Failed to update user.')
      setIsSaving(false)
      return
    }
    setIsSaving(false)
  }

  async function handleFreeze(cardId) {
    setPendingCardId(cardId)
    await runAction(onCardBlock, cardId, setError)
    setPendingCardId(null)
  }

  async function handleUnfreeze(cardId) {
    setPendingCardId(cardId)
    await runAction(onCardUnblock, cardId, setError)
    setPendingCardId(null)
  }

  async function handleStatusToggle() {
    setStatusAction(true)
    await runAction(isSuspended ? onActivate : onSuspend, selectedUser.id, setError)
    setStatusAction(false)
  }

  async function handleDelete() {
    setStatusAction(true)
    await runAction(onDelete, selectedUser.id, (msg) => {
      setError(msg)
      setStatusAction(false)
    })
  }

  if (!selectedUser) return null

  const leftPanel = (
    <>
      <div className="flex items-center gap-3.5">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
          {initialsFor(selectedUser.fullName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-card-foreground">{selectedUser.fullName}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="truncate text-xs text-muted-foreground" title={selectedUser.email}>
              {selectedUser.email}
            </span>
            <button
              type="button"
              onClick={copyEmail}
              aria-label={emailCopied ? 'Email copied' : 'Copy email'}
              title={emailCopied ? 'Copied' : 'Copy email'}
              className="shrink-0 rounded-input p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {emailCopied ? (
                <Check className="size-3.5 text-success" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex h-6 items-center rounded-pill border px-2.5 text-[11px] font-bold uppercase tracking-wide ${roleBadgeClass(selectedUser.role)}`}>
          {titleCase(selectedUser.role)}
        </span>
        <span className={`inline-flex h-6 items-center gap-1.5 rounded-pill border px-2.5 text-[11px] font-semibold capitalize ${
          selectedUser.status === 'active'
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-warning/30 bg-warning/10 text-warning'
        }`}>
          <span className={`size-1.5 rounded-full ${selectedUser.status === 'active' ? 'bg-success' : 'bg-warning'}`} />
          {selectedUser.status}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-1.5 text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Last login</dt>
          <dd className="font-medium text-card-foreground">--</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Joined</dt>
          <dd className="font-medium text-card-foreground">--</dd>
        </div>
      </dl>

      <div className="grid grid-cols-2 gap-2">
        <StatTile icon={CreditCard} label="Total Cards" value={stats.total} />
        <StatTile icon={CreditCard} label="Active" value={stats.active} tone="text-success" />
        <StatTile icon={Snowflake} label="Frozen" value={stats.frozen} tone="text-warning" />
        <StatTile icon={Activity} label="Role" value={<span className="text-sm capitalize">{selectedUser.role}</span>} />
      </div>

      <div className="space-y-3">
        <SplitModalContextLabel>User Controls</SplitModalContextLabel>
        {isAdmin ? (
          <div className="space-y-1">
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Role</label>
            <IconSelect
              icon={User}
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              options={roleOptions}
              disabled={isSaving}
            />
            <p className="text-[11px] text-muted-foreground">
              Change account status from the actions below.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            You can suspend or reactivate this account and freeze cards. Role changes
            are restricted to admins.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs shadow-none"
            disabled
            title="Coming soon"
          >
            <KeyRound className="size-3.5" aria-hidden />
            Reset Password
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs shadow-none"
            disabled
            title="Coming soon"
          >
            <Mail className="size-3.5" aria-hidden />
            Magic Link
          </Button>
        </div>
      </div>

      <div className={`space-y-2 rounded-surface border p-3 ${
        isAdmin ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-background/50'
      }`}>
        <SplitModalContextLabel className={isAdmin ? 'text-destructive' : undefined}>
          {isAdmin ? 'Danger Zone' : 'Account Actions'}
        </SplitModalContextLabel>
        <div className={`grid gap-2 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {typeof onSuspend === 'function' && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-warning/40 text-xs text-warning shadow-none hover:bg-warning/10"
              disabled={statusAction}
              onClick={handleStatusToggle}
            >
              <UserMinus className="size-3.5" aria-hidden />
              {isSuspended ? 'Activate' : 'Suspend'}
            </Button>
          )}
          {isAdmin ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-destructive/40 text-xs text-destructive shadow-none hover:bg-destructive/10"
              disabled={statusAction}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </Button>
          ) : null}
        </div>
        {isAdmin && confirmDelete ? (
          <div className="space-y-2 rounded-input border border-destructive/30 bg-background/60 p-2.5">
            <p className="text-xs text-card-foreground">
              Deactivate this user? Their account is soft-deleted and can be restored later.
              Users with a pending transaction can&apos;t be deleted until it settles.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="h-8 flex-1 text-xs"
                disabled={statusAction}
                onClick={handleDelete}
              >
                {statusAction ? 'Deleting…' : 'Confirm delete'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 flex-1 text-xs shadow-none"
                disabled={statusAction}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )

  const footer = (
    <>
      {error ? <p className="text-xs text-destructive sm:mr-auto">{error}</p> : <span className="sm:mr-auto" />}
      <div className="flex gap-2">
        <Button variant="outline" className="shadow-none" onClick={() => setSelectedUser(null)} disabled={isSaving}>
          Close
        </Button>
        {isAdmin ? (
          <Button onClick={handleSave} disabled={isSaving || !isRoleDirty}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        ) : null}
      </div>
    </>
  )

  return (
    <SplitModal
      isOpen={Boolean(selectedUser)}
      onClose={() => setSelectedUser(null)}
      size="5xl"
      eyebrow="User Management"
      title="View and manage user details, cards and activity"
      leftPanel={leftPanel}
      footer={footer}
    >
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-card-foreground'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        {activeTab === 'cards' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-card-foreground">
                Cards <span className="text-muted-foreground">({cards.length})</span>
              </p>
            </div>
            {cards.length === 0 ? (
              <EmptyTab message="This user has no cards." />
            ) : (
              <div className="grid gap-2.5">
                {cards.map((item) => (
                  <CardRow
                    key={item.id}
                    item={item}
                    canManageCards={canManageCards}
                    onFreeze={handleFreeze}
                    onUnfreeze={handleUnfreeze}
                    pending={pendingCardId === item.rawId}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'transactions' ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-card-foreground">
              Transactions{transactions ? <span className="text-muted-foreground"> ({transactions.length})</span> : null}
            </p>
            {isTabLoading ? (
              <TabLoading />
            ) : tabError ? (
              <EmptyTab message={tabError} />
            ) : transactions && transactions.length > 0 ? (
              <div className="grid max-h-96 gap-2 overflow-y-auto pr-1">
                {transactions.map((tx) => (
                  <TransactionRow key={tx.transaction_id} tx={tx} />
                ))}
              </div>
            ) : (
              <EmptyTab message="This user has no transactions." />
            )}
          </div>
        ) : null}

        {activeTab === 'activity' ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-card-foreground">
              Refund Activity{activity ? <span className="text-muted-foreground"> ({activity.length})</span> : null}
            </p>
            {isTabLoading ? (
              <TabLoading />
            ) : tabError ? (
              <EmptyTab message={tabError} />
            ) : activity && activity.length > 0 ? (
              <div className="grid max-h-96 gap-2 overflow-y-auto pr-1">
                {activity.map((req) => (
                  <ActivityRow key={req.request_id} req={req} />
                ))}
              </div>
            ) : (
              <EmptyTab message="No refund requests from this user." />
            )}
          </div>
        ) : null}
      </div>
    </SplitModal>
  )
}
