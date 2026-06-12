import AdminCardsManagementPanel from '@/components/admin/AdminCardsManagementPanel'
import AdminKpiRow from '@/components/admin/AdminKpiRow'
import AdminTransactionsPanel from '@/components/admin/AdminTransactionsPanel'
import AdminUsersPanel from '@/components/admin/AdminUsersPanel'
import ManageCardDialog from '@/components/admin/ManageCardDialog'
import UserDetailsDialog from '@/components/admin/UserDetailsDialog'
import useAdminPageState from '@/hooks/useAdminPageState'
import { useAuth } from '@/hooks/useAuth'

export default function AdminPage() {
  const { isAdmin } = useAuth()
  const {
    activeSection,
    usersPanel,
    cardsPanel,
    selectedUser,
    setSelectedUser,
    showAllCards,
    kpiTotals,
    resetAllFilters,
    isLoading,
    error,
    managedCard,
    openManageCard,
    closeManageCard,
    handleUserSave,
    handleCardUpdate,
    handleCardDelete,
    userRoles,
    userStatuses,
    cardStatuses,
  } = useAdminPageState()

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-destructive">
          Failed to load admin data. Please refresh the page.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AdminKpiRow kpiTotals={kpiTotals} isLoading={isLoading} />

      {isLoading ? (
        <div className="grid gap-4 xl:grid-cols-12 animate-pulse">
          <div className="h-96 rounded-surface bg-muted xl:col-span-7" />
          <div className="h-96 rounded-surface bg-muted xl:col-span-5" />
        </div>
      ) : (
      <section className="grid gap-4 xl:grid-cols-12">
        <AdminUsersPanel
          activeSection={activeSection}
          userSearch={usersPanel.userSearch}
          setUserSearch={usersPanel.setUserSearch}
          userSort={usersPanel.userSort}
          setUserSort={usersPanel.setUserSort}
          userChipFilter={usersPanel.userChipFilter}
          setUserChipFilter={usersPanel.setUserChipFilter}
          paginatedUsers={usersPanel.paginatedUsers}
          resetAllFilters={resetAllFilters}
          showAllCards={showAllCards}
          focusedUserId={usersPanel.focusedUserId}
          focusUserCards={usersPanel.focusUserCards}
          openUserDetails={usersPanel.openUserDetails}
          userPage={usersPanel.userPage}
          totalUserPages={usersPanel.totalUserPages}
          setUserPage={usersPanel.setUserPage}
        />

        <AdminCardsManagementPanel
          activeSection={activeSection}
          activeUserForCards={cardsPanel.activeUserForCards}
          showAllCards={showAllCards}
          cardStatusFilter={cardsPanel.cardStatusFilter}
          setCardStatusFilter={cardsPanel.setCardStatusFilter}
          cardSort={cardsPanel.cardSort}
          setCardSort={cardsPanel.setCardSort}
          showCardsForAllUsers={cardsPanel.showCardsForAllUsers}
          focusedUserId={usersPanel.focusedUserId}
          unmatchedCards={cardsPanel.unmatchedCards}
          paginatedCards={cardsPanel.paginatedCards}
          resetAllFilters={resetAllFilters}
          onManageCard={openManageCard}
          cardPage={cardsPanel.cardPage}
          totalCardPages={cardsPanel.totalCardPages}
          setCardPage={cardsPanel.setCardPage}
        />
      </section>
      )}

      {!isLoading ? <AdminTransactionsPanel /> : null}

      <UserDetailsDialog
        selectedUser={selectedUser}
        setSelectedUser={setSelectedUser}
        userRoles={userRoles}
        userStatuses={userStatuses}
        onSave={handleUserSave}
        isAdmin={isAdmin}
      />

      <ManageCardDialog
        card={managedCard}
        onClose={closeManageCard}
        onUpdate={handleCardUpdate}
        onDelete={handleCardDelete}
        isAdmin={isAdmin}
        cardStatuses={cardStatuses}
      />

    </div>
  )
}
