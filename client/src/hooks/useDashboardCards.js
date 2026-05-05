import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { listCards } from '@/services/cardsService'
import cardTypesService from '@/services/cardTypesService'
import cardStatusesService from '@/services/cardStatusesService'
import { getUserDisplayName, normalizeApiCards } from '@/utils/cardApiAdapter'

export function useDashboardCards() {
  const { user, isLoading: authLoading } = useAuth()
  const [cards, setCards] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Keep skeleton up while auth is still bootstrapping.
    if (authLoading) return

    let ignore = false

    if (!user?.id) {
      Promise.resolve().then(() => {
        if (!ignore) setIsLoading(false)
      })
      return () => {
        ignore = true
      }
    }

    Promise.resolve().then(() => {
      if (ignore) return
      setIsLoading(true)
      setError(null)
    })

    Promise.all([
      listCards({ user_id: user.id }),
      cardTypesService.list(),
      cardStatusesService.list(),
      ])
      .then(([rawCards, cardTypes, cardStatuses]) => {
        const holderName = getUserDisplayName(user)
        setCards(normalizeApiCards(rawCards, cardTypes, cardStatuses, holderName))
      })
      .catch(setError)
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [authLoading, user])

  return { cards, isLoading, error }
}
