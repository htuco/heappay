import AdminCardsManagementPanel from '@/components/admin/AdminCardsManagementPanel'
import AdminDemoToast from '@/components/admin/AdminDemoToast'
import AdminKpiRow from '@/components/admin/AdminKpiRow'
import AdminUsersPanel from '@/components/admin/AdminUsersPanel'
import UserDetailsDialog from '@/components/admin/UserDetailsDialog'
import useAdminPageState from '@/hooks/useAdminPageState'

export default function AdminPage() {
  const {
    activeSection,
    usersPanel,
    cardsPanel,
    selectedUser,
    setSelectedUser,
    showAllCards,
    feedbackToast,
    setFeedbackToast,
    kpiTotals,
    resetAllFilters,
  } = useAdminPageState()

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Manage users and cards with mock controls for the initial admin experience.
        </p>
      </header>

      <AdminKpiRow kpiTotals={kpiTotals} />

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
          setFeedbackToast={setFeedbackToast}
          cardPage={cardsPanel.cardPage}
          totalCardPages={cardsPanel.totalCardPages}
          setCardPage={cardsPanel.setCardPage}
        />
      </section>

      <UserDetailsDialog selectedUser={selectedUser} setSelectedUser={setSelectedUser} />

      <AdminDemoToast message={feedbackToast} />
    </div>
  )
}
