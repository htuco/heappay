import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { listCards } from '@/services/cardsService'
import cardTypesService from '@/services/cardTypesService'
import cardStatusesService from '@/services/cardStatusesService'

const DISABLED_STATUSES = new Set(['frozen', 'expired', 'cancelled'])

function normalizeCards(rawCards, typesById, statusesById, holderName) {
  return rawCards.map((card) => {
    const statusName = statusesById[card.status_id]?.status_name ?? ''
    const vendor = (typesById[card.card_type_id]?.vendor ?? '').toLowerCase()

    return {
      id: String(card.card_id),
      card: {
        cardHolderName: holderName,
        cardNumber: card.masked_card_number,
        expiryDate: card.expires_at,
        brand: vendor || 'unknown',
        isActive: statusName === 'active',
        isDisabled: DISABLED_STATUSES.has(statusName),
      },
    }
  })
}

export function useDashboardCards() {
  const { user, isLoading: authLoading } = useAuth()
  const [cards, setCards] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Keep skeleton up while auth is still bootstrapping.
    if (authLoading) return

    let cancelled = false
    const loadCards = async () => {
      if (!user?.id) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const [rawCards, cardTypes, cardStatuses] = await Promise.all([
          listCards({ user_id: user.id }),
          cardTypesService.list(),
          cardStatusesService.list(),
        ])

        const typesById = Object.fromEntries(
          cardTypes.map((t) => [t.card_type_id, t])
        )
        const statusesById = Object.fromEntries(
          cardStatuses.map((s) => [s.card_status_id, s])
        )
        const holderName = `${user.first_name} ${user.last_name}`
        if (!cancelled) {
          setCards(normalizeCards(rawCards, typesById, statusesById, holderName))
        }
      } catch (err) {
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadCards()
    return () => {
      cancelled = true
    }
  }, [authLoading, user?.id, user?.first_name, user?.last_name])

  return { cards, isLoading, error }
}
