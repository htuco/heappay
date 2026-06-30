import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { listCards } from '@/services/cardsService'
import cardTypesService from '@/services/cardTypesService'
import cardStatusesService from '@/services/cardStatusesService'
import { getUserDisplayName, normalizeApiCards } from '@/utils/cardApiAdapter'
import { subscribeDataChange } from '@/utils/dataEvents'

const MIN_LOADER_MS = 1500

function getUserId(user) {
  return user?.id ?? user?.user_id ?? null
}

export function useDashboardCards() {
  const { user, isLoading: authLoading } = useAuth()
  const userId = getUserId(user)
  const holderName = getUserDisplayName(user)
  const [cards, setCards] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadCards = useCallback(
    async ({ showLoader = true } = {}) => {
      if (!userId) return
      if (showLoader) setIsLoading(true)
      setError(null)
      const startedAt = Date.now()
      try {
        const [rawCards, cardTypes, cardStatuses] = await Promise.all([
          listCards({ user_id: userId }),
          cardTypesService.list(),
          cardStatusesService.list(),
        ])
        setCards(normalizeApiCards(rawCards, cardTypes, cardStatuses, holderName))
      } catch (err) {
        setError(err)
      }

      if (showLoader) {
        const elapsed = Date.now() - startedAt
        const remaining = Math.max(MIN_LOADER_MS - elapsed, 0)
        setTimeout(() => setIsLoading(false), remaining)
      }
    },
    [holderName, userId]
  )

  useEffect(() => {
    if (authLoading) return
    if (!userId) {
      let cancelled = false
      Promise.resolve().then(() => {
        if (!cancelled) setIsLoading(false)
      })
      return () => {
        cancelled = true
      }
    }
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) loadCards()
    })
    return () => {
      cancelled = true
    }
  }, [authLoading, userId, loadCards])

  useEffect(() => {
    return subscribeDataChange(() => {
      loadCards({ showLoader: false })
    })
  }, [loadCards])

  return { cards, isLoading, error, refetch: loadCards }
}
