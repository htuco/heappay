import { USER_CHIP_OPTIONS, USER_PAGE_SIZE, USER_SORT_OPTIONS } from '@/utils/admin.constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { getRoleBadgeVariant } from '@/utils/admin.utils'

export default function AdminUsersPanel({
  activeSection,
  userSearch,
  setUserSearch,
  userSort,
  setUserSort,
  userChipFilter,
  setUserChipFilter,
  paginatedUsers,
  resetAllFilters,
  showAllCards,
  focusedUserId,
  focusUserCards,
  openUserDetails,
  userPage,
  totalUserPages,
  setUserPage,
}) {
  const emptyRows = Math.max(0, USER_PAGE_SIZE - paginatedUsers.length)

  return (
    <article
      className={`rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 xl:col-span-7 ${
        activeSection === 'cards' ? 'xl:order-2' : ''
      }`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Admin Users</h2>
          <p className="text-xs text-muted-foreground">Search and filter users</p>
        </div>

        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
          <Input
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder="Search name or email"
            className="sm:w-56"
          />
          <Select
            value={userSort}
            onChange={(event) => setUserSort(event.target.value)}
            options={USER_SORT_OPTIONS}
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {USER_CHIP_OPTIONS.map((chip) => (
          <Button
            key={chip.value}
            size="sm"
            variant={userChipFilter === chip.value ? 'default' : 'outline'}
            onClick={() => setUserChipFilter(chip.value)}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {paginatedUsers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/50 p-6 text-center">
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
          <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
            <table className="w-full min-w-[620px] table-fixed text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className={`border-t border-border transition-colors ${
                      !showAllCards && focusedUserId === user.id ? 'bg-primary/5' : 'hover:bg-muted/40'
                    }`}
                    onClick={() => focusUserCards(user)}
                  >
                    <td className="px-4 py-3 font-medium text-card-foreground">
                      <span className="block truncate" title={user.fullName}>
                        {user.fullName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="block truncate" title={user.email}>
                        {user.email}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.status === 'active' ? 'success' : 'warning'}>{user.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          openUserDetails(user)
                        }}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
                {emptyRows > 0 && (
                  <tr className="border-t border-border">
                    <td colSpan={5} className="p-0">
                      <div style={{ minHeight: `${emptyRows * 56}px` }} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {paginatedUsers.map((user) => (
              <article
                key={user.id}
                className={`rounded-2xl border bg-background p-3 transition-colors ${
                  !showAllCards && focusedUserId === user.id
                    ? 'border-primary/40 ring-1 ring-primary/30'
                    : 'border-border'
                }`}
                onClick={() => focusUserCards(user)}
              >
                <p className="font-medium text-card-foreground">{user.fullName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                  <Badge variant={user.status === 'active' ? 'success' : 'warning'}>{user.status}</Badge>
                </div>
                <Button
                  className="mt-3"
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation()
                    openUserDetails(user)
                  }}
                >
                  View
                </Button>
              </article>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUserPage((page) => Math.max(1, page - 1))}
              disabled={userPage === 1}
            >
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {userPage} / {totalUserPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUserPage((page) => Math.min(totalUserPages, page + 1))}
              disabled={userPage === totalUserPages}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </article>
  )
}
