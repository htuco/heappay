import AdminCardPreviewSection from '@/components/admin/AdminCardPreviewSection'
import AdminCardsManagementPanel from '@/components/admin/AdminCardsManagementPanel'
import AdminDemoToast from '@/components/admin/AdminDemoToast'
import AdminKpiRow from '@/components/admin/AdminKpiRow'
import AdminUsersPanel from '@/components/admin/AdminUsersPanel'
import UserDetailsDialog from '@/components/admin/UserDetailsDialog'
import useAdminPageState from '@/hooks/useAdminPageState'

export default function AdminPage() {
  const {
    activeSection,
    userSearch,
    setUserSearch,
    userChipFilter,
    setUserChipFilter,
    userSort,
    setUserSort,
    cardStatusFilter,
    setCardStatusFilter,
    cardSort,
    setCardSort,
    selectedUser,
    setSelectedUser,
    focusedUserId,
    showAllCards,
    feedbackToast,
    setFeedbackToast,
    unmatchedCards,
    activeUserForCards,
    paginatedUsers,
    paginatedCards,
    totalUserPages,
    totalCardPages,
    userPage,
    setUserPage,
    cardPage,
    setCardPage,
    kpiTotals,
    resetAllFilters,
    focusUserCards,
    openUserDetails,
    showCardsForAllUsers,
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
          userSearch={userSearch}
          setUserSearch={setUserSearch}
          userSort={userSort}
          setUserSort={setUserSort}
          userChipFilter={userChipFilter}
          setUserChipFilter={setUserChipFilter}
          paginatedUsers={paginatedUsers}
          resetAllFilters={resetAllFilters}
          showAllCards={showAllCards}
          focusedUserId={focusedUserId}
          focusUserCards={focusUserCards}
          openUserDetails={openUserDetails}
          userPage={userPage}
          totalUserPages={totalUserPages}
          setUserPage={setUserPage}
        />

        <AdminCardsManagementPanel
          activeSection={activeSection}
          activeUserForCards={activeUserForCards}
          showAllCards={showAllCards}
          cardStatusFilter={cardStatusFilter}
          setCardStatusFilter={setCardStatusFilter}
          cardSort={cardSort}
          setCardSort={setCardSort}
          showCardsForAllUsers={showCardsForAllUsers}
          focusedUserId={focusedUserId}
          unmatchedCards={unmatchedCards}
          paginatedCards={paginatedCards}
          resetAllFilters={resetAllFilters}
          setFeedbackToast={setFeedbackToast}
          cardPage={cardPage}
          totalCardPages={totalCardPages}
          setCardPage={setCardPage}
        />

        <AdminCardPreviewSection items={paginatedCards} />
      </section>

      <UserDetailsDialog selectedUser={selectedUser} setSelectedUser={setSelectedUser} />

      <AdminDemoToast message={feedbackToast} />
    </div>
  )
}
