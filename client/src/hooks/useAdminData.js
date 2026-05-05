import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import usersService from '@/services/usersService'
import { listCards } from '@/services/cardsService'
import cardTypesService from '@/services/cardTypesService'
import cardStatusesService from '@/services/cardStatusesService'
import userRolesService from '@/services/userRolesService'
import api from '@/utils/api'
import { buildCardAssignments } from '@/utils/admin.utils'

const DISABLED_CARD_STATUSES = new Set(['frozen', 'expired', 'cancelled'])

function normalizeUsers(rawUsers, rolesById, userStatusesById) {
  return rawUsers.map((user) => ({
    id: user.user_id,
    fullName: `${user.first_name} ${user.last_name}`.trim(),
    email: user.email,
    role: rolesById[user.user_role_id]?.role_name ?? 'user',
    status: userStatusesById[user.status_id]?.status_name ?? 'active',
    created_at: user.created_at,
  }))
}

function normalizeCards(rawCards, cardTypesById, cardStatusesById, usersByNumericId) {
  return rawCards.map((card) => {
    const statusName = cardStatusesById[card.status_id]?.status_name ?? ''
    const owner = usersByNumericId[card.user_id]
    return {
      id: String(card.card_id),
      userId: card.user_id,
      card: {
        cardHolderName: owner?.fullName ?? 'Unknown',
        cardNumber: card.masked_card_number,
        expiryDate: card.expires_at,
        brand: (cardTypesById[card.card_type_id]?.vendor ?? '').toLowerCase(),
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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (authLoading) return

    setIsLoading(true)
    setError(null)

    Promise.all([
      usersService.list({ limit: 200 }),
      listCards({ limit: 500 }),
      cardTypesService.list(),
      cardStatusesService.list(),
      userRolesService.list(),
      api.get('/user-statuses').then((r) => r.data),
    ])
      .then(([rawUsers, rawCards, cardTypes, cardStatuses, userRoles, userStatuses]) => {
        const rolesById = Object.fromEntries(
          userRoles.map((r) => [r.role_id, r])
        )
        const userStatusesById = Object.fromEntries(
          userStatuses.map((s) => [s.id, s])
        )
        const cardTypesById = Object.fromEntries(
          cardTypes.map((t) => [t.card_type_id, t])
        )
        const cardStatusesById = Object.fromEntries(
          cardStatuses.map((s) => [s.card_status_id, s])
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
        setUsersWithCards(result.usersWithCards)
        setUnmatchedCards(result.unmatchedCards)
      })
      .catch(setError)
      .finally(() => setIsLoading(false))
  }, [authLoading])

  return { usersWithCards, unmatchedCards, isLoading, error }
}
