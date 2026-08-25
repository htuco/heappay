import AdminUsersKpiStrip from '@/components/admin/AdminUsersKpiStrip'
import AdminUsersPanel from '@/components/admin/AdminUsersPanel'
import UserDetailsDialog from '@/components/admin/UserDetailsDialog'
import useAdminPageState from '@/hooks/useAdminPageState'
import { useAuth } from '@/hooks/useAuth'

export default function AdminUsersPage() {
  const { isAdmin } = useAuth()
  const {
    usersPanel,
    selectedUser,
    setSelectedUser,
    resetAllFilters,
    kpiTotals,
    isLoading,
    error,
    handleUserSave,
    handleCardBlock,
    handleCardUnblock,
    handleUserSuspend,
    handleUserActivate,
    handleUserDelete,
    handlePasswordReset,
    userRoles,
  } = useAdminPageState()

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-destructive">
          Failed to load admin data. Please refresh the page.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AdminUsersKpiStrip kpiTotals={kpiTotals} isLoading={isLoading} />

      {isLoading ? (
        <div className="h-96 animate-pulse rounded-panel border border-border bg-muted" />
      ) : (
        <AdminUsersPanel
          userSearch={usersPanel.userSearch}
          setUserSearch={usersPanel.setUserSearch}
          userSort={usersPanel.userSort}
          setUserSort={usersPanel.setUserSort}
          userChipFilter={usersPanel.userChipFilter}
          setUserChipFilter={usersPanel.setUserChipFilter}
          userStatusFilter={usersPanel.userStatusFilter}
          setUserStatusFilter={usersPanel.setUserStatusFilter}
          paginatedUsers={usersPanel.paginatedUsers}
          resetAllFilters={resetAllFilters}
          openUserDetails={usersPanel.openUserDetails}
          userPage={usersPanel.userPage}
          totalUserPages={usersPanel.totalUserPages}
          setUserPage={usersPanel.setUserPage}
          totalUsers={kpiTotals.totalUsers}
        />
      )}

      <UserDetailsDialog
        selectedUser={selectedUser}
        setSelectedUser={setSelectedUser}
        userRoles={userRoles}
        onSave={handleUserSave}
        onCardBlock={handleCardBlock}
        onCardUnblock={handleCardUnblock}
        onSuspend={handleUserSuspend}
        onActivate={handleUserActivate}
        onDelete={handleUserDelete}
        onPasswordReset={handlePasswordReset}
        isAdmin={isAdmin}
      />
    </div>
  )
}
