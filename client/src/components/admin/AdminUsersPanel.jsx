import { ListFilter, Search } from 'lucide-react'

import {
  USER_PAGE_SIZE,
  USER_ROLE_FILTER_OPTIONS,
  USER_SORT_OPTIONS,
  USER_STATUS_FILTER_OPTIONS,
} from '@/utils/admin.constants'
import { titleCase } from '@/utils/admin.utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

const AVATAR_TONES = [
  'bg-primary/15 text-primary',
  'bg-success/15 text-success',
  'bg-info/15 text-info',
  'bg-warning/15 text-warning',
  'bg-destructive/15 text-destructive',
  'bg-secondary text-secondary-foreground',
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

// Deterministic per-user avatar colour so the same user always reads the same.
function avatarTone(seed) {
  const str = String(seed ?? '')
  let hash = 0
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

function RoleChip({ role }) {
  const styles = {
    admin: 'border-primary/30 bg-primary/10 text-primary',
    manager: 'border-info/30 bg-info/10 text-info',
    support: 'border-warning/30 bg-warning/10 text-warning',
  }
  return (
    <span className={`inline-flex h-6 items-center rounded-chip border px-2.5 text-[11px] font-semibold ${styles[role] ?? 'border-border bg-muted/40 text-muted-foreground'}`}>
      {titleCase(role)}
    </span>
  )
}

function StatusPill({ status }) {
  const active = status === 'active'
  const suspended = status === 'suspended'
  const tone = active
    ? 'border-success/30 bg-success/10 text-success'
    : suspended
    ? 'border-destructive/30 bg-destructive/10 text-destructive'
    : 'border-warning/30 bg-warning/10 text-warning'
  const dot = active ? 'bg-success' : suspended ? 'bg-destructive' : 'bg-warning'
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-chip border px-2.5 text-[11px] font-semibold capitalize ${tone}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  )
}

function UserAvatar({ user }) {
  return (
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarTone(user.email || user.id)}`}>
      {initialsFor(user.fullName)}
    </span>
  )
}

export default function AdminUsersPanel({
  userSearch,
  setUserSearch,
  userSort,
  setUserSort,
  userChipFilter,
  setUserChipFilter,
  userStatusFilter,
  setUserStatusFilter,
  paginatedUsers,
  resetAllFilters,
  openUserDetails,
  userPage,
  totalUserPages,
  setUserPage,
  totalUsers,
}) {
  const emptyRows = Math.max(0, USER_PAGE_SIZE - paginatedUsers.length)

  return (
    <article className="overflow-hidden rounded-panel border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search by name or email…"
              className="h-9 border-border/70 bg-background pl-9 text-sm shadow-none"
            />
          </div>
          <Select
            aria-label="Filter by role"
            value={userChipFilter}
            onChange={(event) => setUserChipFilter(event.target.value)}
            options={USER_ROLE_FILTER_OPTIONS}
            className="h-9 border-border/70 bg-background py-0 text-sm shadow-none sm:w-36"
          />
          <Select
            aria-label="Filter by status"
            value={userStatusFilter}
            onChange={(event) => setUserStatusFilter(event.target.value)}
            options={USER_STATUS_FILTER_OPTIONS}
            className="h-9 border-border/70 bg-background py-0 text-sm shadow-none sm:w-36"
          />
          <Select
            aria-label="Sort users"
            value={userSort}
            onChange={(event) => setUserSort(event.target.value)}
            options={USER_SORT_OPTIONS}
            className="h-9 border-border/70 bg-background py-0 text-sm shadow-none sm:w-40"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 shrink-0 border-border/70 p-0 shadow-none"
            onClick={resetAllFilters}
            title="Reset filters"
            aria-label="Reset filters"
          >
            <ListFilter className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {paginatedUsers.length === 0 ? (
          <div className="rounded-surface border border-dashed border-border bg-background/50 p-8 text-center">
            <p className="font-medium text-card-foreground">No users found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try different filters or reset the current search criteria.
            </p>
            <Button className="mt-4" variant="outline" onClick={resetAllFilters}>
              Reset filters
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-surface border border-border lg:block">
              <table className="w-full min-w-205 table-fixed text-left text-sm">
                <thead className="border-b border-border/60 bg-muted/25 text-[11px] uppercase tracking-wider text-muted-foreground/70">
                  <tr>
                    <th className="w-[26%] px-4 py-3 font-semibold">User</th>
                    <th className="w-[12%] px-4 py-3 font-semibold">Role</th>
                    <th className="w-[10%] px-4 py-3 font-semibold">Cards</th>
                    <th className="w-[15%] px-4 py-3 font-semibold">Spend (MTD)</th>
                    <th className="w-[13%] px-4 py-3 font-semibold">Last Active</th>
                    <th className="w-[12%] px-4 py-3 font-semibold">Status</th>
                    <th className="w-[12%] px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/45">
                  {paginatedUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="cursor-pointer transition-colors hover:bg-muted/25"
                      onClick={() => openUserDetails(user)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <UserAvatar user={user} />
                          <div className="min-w-0">
                            <span className="block truncate font-medium text-card-foreground" title={user.fullName}>
                              {user.fullName}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground" title={user.email}>
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleChip role={user.role} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="font-medium text-card-foreground tabular-nums">{user.cards.length}</span>{' '}
                        <span className="text-xs">Cards</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">—</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">—</td>
                      <td className="px-4 py-3">
                        <StatusPill status={user.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs shadow-none"
                            onClick={(event) => {
                              event.stopPropagation()
                              openUserDetails(user)
                            }}
                          >
                            Manage
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {emptyRows > 0 ? (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <div style={{ minHeight: `${emptyRows * 57}px` }} />
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 lg:hidden">
              {paginatedUsers.map((user) => (
                <article
                  key={user.id}
                  className="rounded-surface border border-border bg-background p-3 transition-colors"
                  onClick={() => openUserDetails(user)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={user} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-card-foreground">{user.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 px-3 text-xs shadow-none"
                      onClick={(event) => {
                        event.stopPropagation()
                        openUserDetails(user)
                      }}
                    >
                      Manage
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <RoleChip role={user.role} />
                    <StatusPill status={user.status} />
                    <span className="text-xs text-muted-foreground">{user.cards.length} cards</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {typeof totalUsers === 'number'
                  ? `Showing page ${userPage} of ${totalUserPages} · ${totalUsers} users`
                  : `Page ${userPage} / ${totalUserPages}`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-input text-xs shadow-none"
                  onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                  disabled={userPage === 1}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-input text-xs shadow-none"
                  onClick={() => setUserPage((page) => Math.min(totalUserPages, page + 1))}
                  disabled={userPage === totalUserPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  )
}
