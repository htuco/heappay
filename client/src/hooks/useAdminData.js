import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import usersService from '@/services/usersService'
import { listCards } from '@/services/cardsService'
import cardTypesService from '@/services/cardTypesService'
import cardStatusesService from '@/services/cardStatusesService'
import userRolesService from '@/services/userRolesService'
import userStatusesService from '@/services/userStatusesService'
import { buildCardAssignments } from '@/utils/admin.utils'
import { fetchAllPaginated } from '@/utils/fetchAllPaginated'

const DISABLED_CARD_STATUSES = new Set(['frozen', 'expired', 'cancelled'])

function normalizeUsers(rawUsers, rolesById, userStatusesById) {
  return rawUsers.map((user) => ({
    id: user.user_id,
    fullName: `${user.first_name} ${user.last_name}`.trim(),
    firstName: user.first_name,
    lastName: user.last_name,
    avatarUrl: user.avatar_url ?? null,
    email: user.email,
    role: rolesById[user.user_role_id]?.role_name ?? 'user',
    status: userStatusesById[user.status_id]?.status_name ?? 'active',
    roleId: user.user_role_id,
    statusId: user.status_id,
    created_at: user.created_at,
    lastLoginAt: user.last_login_at ?? null,
    // null means the server didn't compute it for this response; 0 means the
    // user genuinely hasn't spent anything. Keep them distinguishable.
    totalSpent: user.total_spent ?? null,
  }))
}

function normalizeCards(rawCards, cardTypesById, cardStatusesById, usersByNumericId) {
  return rawCards.map((card) => {
    const statusName = cardStatusesById[card.status_id]?.status_name ?? ''
    const owner = usersByNumericId[card.user_id]
    return {
      id: String(card.card_id),
      rawId: card.card_id,
      statusId: card.status_id,
      userId: card.user_id,
      card: {
        cardHolderName: owner?.fullName ?? 'Unknown',
        cardNumber: card.masked_card_number,
        expiryDate: card.expires_at,
        brand: (cardTypesById[card.card_type_id]?.vendor ?? '').toLowerCase(),
        statusName,
        status: statusName,
        isActive: statusName === 'active',
        isDisabled: DISABLED_CARD_STATUSES.has(statusName),
      },
    }
  })
}

export function useAdminData() {
  const { isLoading: authLoading } = useAuth()
  const [usersWithCards, setUsersWithCards] = useState([])
  const [unmatchedCards, setUnmatchedCards] = useState([])
  const [userRoles, setUserRoles] = useState([])
  const [userStatuses, setUserStatuses] = useState([])
  const [cardStatuses, setCardStatuses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    if (authLoading) return

    let cancelled = false

    const loadAdminData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [rawUsers, rawCards, cardTypes, cardStatusesList, userRolesList, userStatusesList] = await Promise.all([
          fetchAllPaginated((page) => usersService.list(page)),
          fetchAllPaginated((page) => listCards(page)),
          cardTypesService.list(),
          cardStatusesService.list(),
          userRolesService.list(),
          userStatusesService.list(),
        ])

        const rolesById = Object.fromEntries(
          userRolesList.map((r) => [r.role_id, r])
        )
        const userStatusesById = Object.fromEntries(
          userStatusesList.map((s) => [s.id, s])
        )
        const cardTypesById = Object.fromEntries(
          cardTypes.map((t) => [t.card_type_id, t])
        )
        const cardStatusesById = Object.fromEntries(
          cardStatusesList.map((s) => [s.card_status_id, s])
        )

        const normalizedUsers = normalizeUsers(rawUsers, rolesById, userStatusesById)
        const usersByNumericId = Object.fromEntries(
          normalizedUsers.map((u) => [u.id, u])
        )
        const normalizedCards = normalizeCards(
          rawCards,
          cardTypesById,
          cardStatusesById,
          usersByNumericId
        )

        const result = buildCardAssignments(normalizedUsers, normalizedCards)
        if (!cancelled) {
          setUsersWithCards(result.usersWithCards)
          setUnmatchedCards(result.unmatchedCards)
          setUserRoles(userRolesList)
          setUserStatuses(userStatusesList)
          setCardStatuses(cardStatusesList)
        }
      } catch (err) {
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadAdminData()
    return () => {
      cancelled = true
    }
  }, [authLoading, refreshKey])

  return { usersWithCards, unmatchedCards, userRoles, userStatuses, cardStatuses, isLoading, error, refresh }
}
