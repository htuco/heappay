import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, MinusCircle, RefreshCw, Search, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import UserDetailModal from '@/components/support/UserDetailModal'
import usersService from '@/services/usersService'
import { useAppSelector } from '@/store/hooks'
import { selectUserRoles } from '@/store/slices/referenceDataSlice'

const PAGE_SIZE = 10

const STATUS_META = {
  1: { Icon: CheckCircle2, color: 'text-emerald-500', label: 'Active' },
  2: { Icon: MinusCircle,  color: 'text-muted-foreground/50', label: 'Inactive' },
  3: { Icon: XCircle,      color: 'text-red-500', label: 'Suspended' },
}

function StatusIcon({ statusId }) {
  const meta = STATUS_META[statusId] ?? STATUS_META[2]
  return <meta.Icon className={`size-4 shrink-0 ${meta.color}`} strokeWidth={1.75} />
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-input border border-border/60 bg-muted/20 px-3 py-2">
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Legend</span>
      {Object.values(STATUS_META).map((meta) => {
        const StatusGlyph = meta.Icon
        return (
          <span key={meta.label} className="flex items-center gap-1.5">
            <StatusGlyph className={`size-3.5 ${meta.color}`} strokeWidth={1.75} />
            <span className="text-xs text-muted-foreground">{meta.label}</span>
          </span>
        )
      })}
    </div>
  )
}

export default function SupportUsersPage() {
  const userRoles = useAppSelector(selectUserRoles)
  const rolesById = useMemo(
    () => Object.fromEntries((userRoles ?? []).map((r) => [r.role_id, r.role_name])),
    [userRoles],
  )

  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingUserId, setPendingUserId] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback(async (p = 1, q = search, role = roleFilter) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = { limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE }
      if (q.trim()) params.q = q.trim()
      if (role) params.userRoleId = Number(role)
      const data = await usersService.list(params)
      setUsers(data)
      setTotal(data.length < PAGE_SIZE && p === 1 ? data.length : (p - 1) * PAGE_SIZE + data.length)
      setPage(p)
    } catch {
      setError('Failed to load users.')
    } finally {
      setIsLoading(false)
    }
  }, [search, roleFilter])

  useEffect(() => { load(1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e) {
    setSearch(e.target.value)
    load(1, e.target.value, roleFilter)
  }

  function handleRoleFilter(value) {
    setRoleFilter(value)
    load(1, search, value)
  }

  async function toggleSuspend(e, user) {
    e.stopPropagation()
    setPendingUserId(user.user_id)
    try {
      const updated = user.status_id === 3
        ? await usersService.activate(user.user_id)
        : await usersService.suspend(user.user_id)
      setUsers((prev) => prev.map((u) => u.user_id === updated.user_id ? updated : u))
      if (selectedUser?.user_id === updated.user_id) setSelectedUser(updated)
    } catch { /* silently ignore */ }
    finally { setPendingUserId(null) }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="rounded-surface border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid w-full gap-2 sm:grid-cols-[minmax(220px,360px)_160px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={handleSearch}
                placeholder="Search by name or email..."
                className="h-9 border-border/70 bg-background pl-9 text-sm shadow-none"
              />
            </label>
            <Select
              value={roleFilter}
              onChange={(e) => handleRoleFilter(e.target.value)}
              options={[{ value: '', label: 'All roles' }, ...(userRoles ?? []).map((r) => ({ value: String(r.role_id), label: r.role_name }))]}
              className="h-9 border-border/70 bg-background py-0 text-xs shadow-none"
            />
            <Button
              variant="outline"
              size="lg"
              className="h-9 gap-2 border-border/70 text-xs shadow-none"
              onClick={() => load(page)}
              disabled={isLoading}
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </Button>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {isLoading ? 'Loading users...' : `${total} user${total !== 1 ? 's' : ''}`}
          </span>
        </div>

        <div className="mt-3">
          <Legend />
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-surface border border-border bg-card shadow-xs">
        <div className="hidden border-b border-border/60 bg-muted/30 px-4 py-2.5 sm:grid sm:grid-cols-[1fr_1fr_100px_120px] sm:gap-x-4">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Name</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Email</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Role</span>
          <span />
        </div>

        <div className="divide-y divide-border/40">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="hidden px-4 py-3 sm:grid sm:grid-cols-[1fr_1fr_100px_120px] sm:items-center sm:gap-x-4">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <div key={j} className="h-3 w-24 animate-pulse rounded-input bg-muted" />
                  ))}
                </div>
              ))
            : users.length === 0
            ? <div className="px-4 py-10 text-center text-sm text-muted-foreground">No users found.</div>
            : users.map((user) => (
              <div
                key={user.user_id}
                className="group grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-3 transition-colors hover:bg-muted/20 sm:grid-cols-[1fr_1fr_100px_120px]"
                onClick={() => setSelectedUser(user)}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <StatusIcon statusId={user.status_id} />
                  <span className="truncate text-sm font-medium text-foreground">
                    {user.first_name} {user.last_name}
                  </span>
                </div>

                <p className="hidden truncate text-sm text-muted-foreground sm:block">{user.email}</p>

                <div className="hidden sm:block">
                  <Badge variant="secondary" className="capitalize">
                    {rolesById[user.user_role_id] ?? user.user_role_id}
                  </Badge>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    className={`h-7 rounded-input px-2.5 text-xs shadow-none ${
                      user.status_id === 3
                        ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400'
                        : 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:text-red-400'
                    }`}
                    disabled={pendingUserId === user.user_id}
                    onClick={(e) => toggleSuspend(e, user)}
                  >
                    {pendingUserId === user.user_id
                      ? <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      : user.status_id === 3 ? 'Activate' : 'Suspend'
                    }
                  </Button>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 rounded-input text-xs shadow-none" disabled={page <= 1 || isLoading} onClick={() => load(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" className="h-8 rounded-input text-xs shadow-none" disabled={page >= totalPages || isLoading} onClick={() => load(page + 1)}>Next</Button>
          </div>
        </div>
      )}

      <UserDetailModal
        user={selectedUser}
        open={Boolean(selectedUser)}
        onOpenChange={(open) => { if (!open) setSelectedUser(null) }}
        rolesById={rolesById}
        onUserUpdated={(updated) => {
          setUsers((prev) => prev.map((u) => u.user_id === updated.user_id ? updated : u))
          setSelectedUser(updated)
        }}
      />
    </div>
  )
}
