import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { listCards } from '@/services/cardsService'
import cardTypesService from '@/services/cardTypesService'
import cardStatusesService from '@/services/cardStatusesService'
import { getUserDisplayName, normalizeApiCards } from '@/utils/cardApiAdapter'
import { subscribeDataChange } from '@/utils/dataEvents'

export function useDashboardCards() {
  const { user, isLoading: authLoading } = useAuth()
  const [cards, setCards] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadCards = useCallback(
    async ({ showLoader = true } = {}) => {
      if (!user?.id) return
      if (showLoader) setIsLoading(true)
      setError(null)
      try {
        const [rawCards, cardTypes, cardStatuses] = await Promise.all([
          listCards({ user_id: user.id }),
          cardTypesService.list(),
          cardStatusesService.list(),
        ])
        const holderName = getUserDisplayName(user)
        setCards(normalizeApiCards(rawCards, cardTypes, cardStatuses, holderName))
      } catch (err) {
        setError(err)
      } finally {
        if (showLoader) setIsLoading(false)
      }
    },
    [user]
  )

  useEffect(() => {
    if (authLoading) return
    if (!user?.id) {
      setIsLoading(false)
      return
    }
    loadCards()
  }, [authLoading, user, loadCards])

  useEffect(() => {
    return subscribeDataChange(() => {
      loadCards({ showLoader: false })
    })
  }, [loadCards])

  return { cards, isLoading, error, refetch: loadCards }
}
