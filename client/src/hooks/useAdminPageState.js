import { useMemo, useState } from 'react'

import { USER_PAGE_SIZE } from '@/utils/admin.constants'
import { useAdminData } from '@/hooks/useAdminData'
import { useAuth } from '@/hooks/useAuth'
import usersService from '@/services/usersService'
import { blockCard, unblockCard } from '@/services/cardsService'
import { useNotifications } from '@/context/NotificationContext'
import { CATEGORIES } from '@/context/notifications/categories'

function userMatchesChip(user, chip) {
  if (chip === 'all') return true
  return user.role === chip
}

function userMatchesStatus(user, status) {
  if (status === 'all') return true
  return user.status === status
}

export default function useAdminPageState() {
  const [userSearch, setUserSearchState] = useState('')
  const [userChipFilter, setUserChipFilterState] = useState('all')
  const [userStatusFilter, setUserStatusFilterState] = useState('all')
  const [userSort, setUserSortState] = useState('name-asc')
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [userPage, setUserPageState] = useState(1)
  const { notify } = useNotifications()
  const { isAdmin } = useAuth()
  // Notifications link back to whichever users surface the actor can reach.
  const usersRoute = isAdmin ? '/admin/users' : '/support/users'

  const { usersWithCards, userRoles, userStatuses, isLoading, error, refresh } = useAdminData()
  const normalizedUserSearch = useMemo(() => userSearch.trim().toLowerCase(), [userSearch])

  const filteredUsers = useMemo(() => {
    return usersWithCards.filter((user) => {
      const matchesSearch =
        user.fullName.toLowerCase().includes(normalizedUserSearch) ||
        user.email.toLowerCase().includes(normalizedUserSearch)
      const matchesChip = userMatchesChip(user, userChipFilter)
      const matchesStatus = userMatchesStatus(user, userStatusFilter)

      return matchesSearch && matchesChip && matchesStatus
    })
  }, [normalizedUserSearch, userChipFilter, userStatusFilter, usersWithCards])

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null
    return usersWithCards.find((user) => user.id === selectedUserId) ?? null
  }, [selectedUserId, usersWithCards])

  const sortedUsers = useMemo(() => {
    const copy = [...filteredUsers]
    copy.sort((a, b) => {
      if (userSort === 'role-asc') return a.role.localeCompare(b.role)
      if (userSort === 'status-asc') return a.status.localeCompare(b.status)
      return a.fullName.localeCompare(b.fullName)
    })
    return copy
  }, [filteredUsers, userSort])

  const totalUserPages = Math.max(1, Math.ceil(sortedUsers.length / USER_PAGE_SIZE))
  const resolvedUserPage = Math.min(userPage, totalUserPages)

  const paginatedUsers = useMemo(() => {
    const start = (resolvedUserPage - 1) * USER_PAGE_SIZE
    return sortedUsers.slice(start, start + USER_PAGE_SIZE)
  }, [resolvedUserPage, sortedUsers])

  const kpiTotals = useMemo(() => {
    const allCards = usersWithCards.flatMap((user) => user.cards)
    const frozenCards = allCards.filter(
      (item) => item.card.status === 'frozen' || item.card.isDisabled
    ).length
    return {
      totalUsers: usersWithCards.length,
      activeUsers: usersWithCards.filter((user) => user.status === 'active').length,
      totalCards: allCards.length,
      disabledCards: frozenCards,
      frozenCards,
    }
  }, [usersWithCards])

  function setUserPage(nextValueOrUpdater) {
    setUserPageState((currentPage) => {
      const requestedPage =
        typeof nextValueOrUpdater === 'function' ? nextValueOrUpdater(currentPage) : nextValueOrUpdater
      return Math.max(1, requestedPage)
    })
  }

  function setUserSearch(nextValue) {
    setUserSearchState(nextValue)
    setUserPage(1)
  }

  function setUserChipFilter(nextValue) {
    setUserChipFilterState(nextValue)
    setUserPage(1)
  }

  function setUserStatusFilter(nextValue) {
    setUserStatusFilterState(nextValue)
    setUserPage(1)
  }

  function setUserSort(nextValue) {
    setUserSortState(nextValue)
    setUserPage(1)
  }

  function resetAllFilters() {
    setUserSearchState('')
    setUserChipFilterState('all')
    setUserStatusFilterState('all')
    setUserSortState('name-asc')
    setSelectedUserId(null)
    setUserPage(1)
  }

  function openUserDetails(user) {
    setSelectedUserId(user.id)
  }

  function setSelectedUser(user) {
    setSelectedUserId(user?.id ?? null)
  }

  async function handleUserSave(userId, payload) {
    await usersService.update(userId, payload)
    refresh()
    notify({
      type: 'success',
      category: CATEGORIES.ADMIN_ACTION,
      message: 'User updated successfully.',
      link: { route: usersRoute },
    })
    setSelectedUserId(null)
  }

  async function handleCardBlock(cardId) {
    await blockCard(cardId)
    refresh()
    notify({
      type: 'success',
      category: CATEGORIES.ADMIN_ACTION,
      message: 'Card frozen.',
      link: { route: usersRoute },
    })
  }

  async function handleCardUnblock(cardId) {
    await unblockCard(cardId)
    refresh()
    notify({
      type: 'success',
      category: CATEGORIES.ADMIN_ACTION,
      message: 'Card unfrozen.',
      link: { route: usersRoute },
    })
  }

  async function handleUserSuspend(userId) {
    await usersService.suspend(userId)
    refresh()
    notify({
      type: 'success',
      category: CATEGORIES.ADMIN_ACTION,
      message: 'User suspended.',
      link: { route: usersRoute },
    })
  }

  async function handleUserActivate(userId) {
    await usersService.activate(userId)
    refresh()
    notify({
      type: 'success',
      category: CATEGORIES.ADMIN_ACTION,
      message: 'User activated.',
      link: { route: usersRoute },
    })
  }

  async function handleUserDelete(userId) {
    await usersService.delete(userId)
    refresh()
    notify({
      type: 'success',
      category: CATEGORIES.ADMIN_ACTION,
      message: 'User deleted.',
      link: { route: usersRoute },
    })
    setSelectedUserId(null)
  }

  const usersPanel = {
    userSearch,
    setUserSearch,
    userChipFilter,
    setUserChipFilter,
    userStatusFilter,
    setUserStatusFilter,
    userSort,
    setUserSort,
    paginatedUsers,
    totalUserPages,
    userPage: resolvedUserPage,
    setUserPage,
    openUserDetails,
  }

  return {
    usersPanel,
    selectedUser,
    setSelectedUser,
    kpiTotals,
    resetAllFilters,
    isLoading,
    error,
    handleUserSave,
    handleCardBlock,
    handleCardUnblock,
    handleUserSuspend,
    handleUserActivate,
    handleUserDelete,
    userRoles,
    userStatuses,
  }
}
