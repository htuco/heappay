import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { CARD_PAGE_SIZE, USER_PAGE_SIZE } from '@/utils/admin.constants'
import { useAdminData } from '@/hooks/useAdminData'
import { getCardStatus } from '@/utils/admin.utils'
import usersService from '@/services/usersService'
import { updateCard, hardDeleteCard } from '@/services/cardsService'
import { useNotifications } from '@/context/NotificationContext'

function userMatchesChip(user, chip) {
  if (chip === 'all') return true
  if (chip === 'invited') return user.status === 'invited'
  return user.role === chip
}

export default function useAdminPageState() {
  const [searchParams] = useSearchParams()
  const sectionParam = searchParams.get('section')
  const activeSection = sectionParam === 'cards' ? 'cards' : 'users'

  const [userSearch, setUserSearchState] = useState('')
  const [userChipFilter, setUserChipFilterState] = useState('all')
  const [userSort, setUserSortState] = useState('name-asc')
  const [cardStatusFilter, setCardStatusFilterState] = useState('all')
  const [cardSort, setCardSortState] = useState('status-asc')
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [managedCard, setManagedCard] = useState(null)
  const [manualFocusedUserId, setManualFocusedUserId] = useState(null)
  const [showAllCards, setShowAllCards] = useState(false)
  const [userPage, setUserPageState] = useState(1)
  const [cardPage, setCardPageState] = useState(1)
  const { notify } = useNotifications()

  const { usersWithCards, unmatchedCards, userRoles, userStatuses, cardStatuses, isLoading, error, refresh } = useAdminData()
  const normalizedUserSearch = useMemo(() => userSearch.trim().toLowerCase(), [userSearch])

  const filteredUsersWithCards = useMemo(() => {
    return usersWithCards.filter((user) => {
      const matchesSearch =
        user.fullName.toLowerCase().includes(normalizedUserSearch) ||
        user.email.toLowerCase().includes(normalizedUserSearch)
      const matchesChip = userMatchesChip(user, userChipFilter)

      return matchesSearch && matchesChip
    })
  }, [normalizedUserSearch, userChipFilter, usersWithCards])

  const focusedUserId = useMemo(() => {
    if (showAllCards) return null

    if (filteredUsersWithCards.length === 1) {
      return filteredUsersWithCards[0].id
    }

    if (!manualFocusedUserId) return null

    const stillVisible = filteredUsersWithCards.some((user) => user.id === manualFocusedUserId)
    return stillVisible ? manualFocusedUserId : null
  }, [filteredUsersWithCards, manualFocusedUserId, showAllCards])

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null
    return usersWithCards.find((user) => user.id === selectedUserId) ?? null
  }, [selectedUserId, usersWithCards])

  const sortedUsers = useMemo(() => {
    const copy = [...filteredUsersWithCards]
    copy.sort((a, b) => {
      if (userSort === 'role-asc') return a.role.localeCompare(b.role)
      if (userSort === 'status-asc') return a.status.localeCompare(b.status)
      return a.fullName.localeCompare(b.fullName)
    })
    return copy
  }, [filteredUsersWithCards, userSort])

  const scopedUsersForCards = useMemo(() => {
    if (showAllCards) return sortedUsers
    if (!focusedUserId) return []
    return sortedUsers.filter((user) => user.id === focusedUserId)
  }, [focusedUserId, showAllCards, sortedUsers])

  const activeUserForCards = useMemo(() => {
    if (!focusedUserId) return null
    return sortedUsers.find((user) => user.id === focusedUserId) ?? null
  }, [focusedUserId, sortedUsers])

  const filteredCards = useMemo(() => {
    const cardsFromScopedUsers = scopedUsersForCards.flatMap((user) =>
      user.cards.map((item, cardIndex) => ({
        ...item,
        id: `${user.id}-${item.id}-${cardIndex}`,
        ownerName: user.fullName,
        ownerEmail: user.email,
      }))
    )

    return cardsFromScopedUsers.filter(({ card }) => {
      if (cardStatusFilter === 'all') return true
      return getCardStatus(card) === cardStatusFilter
    })
  }, [cardStatusFilter, scopedUsersForCards])

  const sortedCards = useMemo(() => {
    const copy = [...filteredCards]
    copy.sort((a, b) => {
      if (cardSort === 'brand-asc') return a.card.brand.localeCompare(b.card.brand)
      return getCardStatus(a.card).localeCompare(getCardStatus(b.card))
    })
    return copy
  }, [cardSort, filteredCards])

  const totalUserPages = Math.max(1, Math.ceil(sortedUsers.length / USER_PAGE_SIZE))
  const totalCardPages = Math.max(1, Math.ceil(sortedCards.length / CARD_PAGE_SIZE))
  const resolvedUserPage = Math.min(userPage, totalUserPages)
  const resolvedCardPage = Math.min(cardPage, totalCardPages)

  const paginatedUsers = useMemo(() => {
    const start = (resolvedUserPage - 1) * USER_PAGE_SIZE
    return sortedUsers.slice(start, start + USER_PAGE_SIZE)
  }, [resolvedUserPage, sortedUsers])

  const paginatedCards = useMemo(() => {
    const start = (resolvedCardPage - 1) * CARD_PAGE_SIZE
    return sortedCards.slice(start, start + CARD_PAGE_SIZE)
  }, [resolvedCardPage, sortedCards])

  const kpiTotals = useMemo(() => {
    const allCards = usersWithCards.flatMap((user) => user.cards)
    return {
      totalUsers: usersWithCards.length,
      activeUsers: usersWithCards.filter((user) => user.status === 'active').length,
      totalCards: allCards.length,
      disabledCards: allCards.filter((item) => item.card.isDisabled).length,
    }
  }, [usersWithCards])


  function setUserSearch(nextValue) {
    setUserSearchState(nextValue)
    setUserPage(1)
    setCardPage(1)
  }

  function setUserChipFilter(nextValue) {
    setUserChipFilterState(nextValue)
    setUserPage(1)
    setCardPage(1)
  }

  function setUserSort(nextValue) {
    setUserSortState(nextValue)
    setUserPage(1)
    setCardPage(1)
  }

  function setCardStatusFilter(nextValue) {
    setCardStatusFilterState(nextValue)
    setCardPage(1)
  }

  function setCardSort(nextValue) {
    setCardSortState(nextValue)
    setCardPage(1)
  }

  function resetAllFilters() {
    setUserSearchState('')
    setUserChipFilterState('all')
    setUserSortState('name-asc')
    setCardStatusFilterState('all')
    setCardSortState('status-asc')
    setSelectedUserId(null)
    setManualFocusedUserId(null)
    setShowAllCards(false)
    setUserPage(1)
    setCardPage(1)
  }

  function focusUserCards(user) {
    setManualFocusedUserId(user.id)
    setShowAllCards(false)
    setCardPage(1)
  }

  function openUserDetails(user) {
    focusUserCards(user)
    setSelectedUserId(user.id)
  }

  function showCardsForAllUsers() {
    setManualFocusedUserId(null)
    setShowAllCards(true)
    setCardPage(1)
  }

  function setSelectedUser(user) {
    setSelectedUserId(user?.id ?? null)
  }

  function openManageCard(cardItem) {
    setManagedCard(cardItem)
  }

  function closeManageCard() {
    setManagedCard(null)
  }

  async function handleUserSave(userId, payload) {
    await usersService.update(userId, payload)
    refresh()
    notify({ type: 'success', message: 'User updated successfully.' })
    setSelectedUserId(null)
  }

  async function handleCardUpdate(cardId, payload) {
    await updateCard(cardId, payload)
    refresh()
    notify({ type: 'success', message: 'Card updated successfully.' })
    closeManageCard()
  }

  async function handleCardDelete(cardId) {
    await hardDeleteCard(cardId)
    refresh()
    notify({ type: 'success', message: 'Card permanently deleted.' })
    closeManageCard()
  }

  function setUserPage(nextValueOrUpdater) {
    setUserPageState((currentPage) => {
      const requestedPage =
        typeof nextValueOrUpdater === 'function' ? nextValueOrUpdater(currentPage) : nextValueOrUpdater
      return Math.max(1, requestedPage)
    })
  }

  function setCardPage(nextValueOrUpdater) {
    setCardPageState((currentPage) => {
      const requestedPage =
        typeof nextValueOrUpdater === 'function' ? nextValueOrUpdater(currentPage) : nextValueOrUpdater
      return Math.max(1, requestedPage)
    })
  }

  const usersPanel = {
    userSearch,
    setUserSearch,
    userChipFilter,
    setUserChipFilter,
    userSort,
    setUserSort,
    paginatedUsers,
    totalUserPages,
    userPage: resolvedUserPage,
    setUserPage,
    focusedUserId,
    focusUserCards,
    openUserDetails,
  }

  const cardsPanel = {
    cardStatusFilter,
    setCardStatusFilter,
    cardSort,
    setCardSort,
    activeUserForCards,
    paginatedCards,
    totalCardPages,
    cardPage: resolvedCardPage,
    setCardPage,
    showCardsForAllUsers,
    unmatchedCards,
  }

  return {
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
  }
}
