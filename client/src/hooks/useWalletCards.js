import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { createCard, deleteCard as deleteCardService, listCards, setMainCard as setMainCardService, updateCard } from '@/services/cardsService'
import cardStatusesService from '@/services/cardStatusesService'
import cardTypesService from '@/services/cardTypesService'
import { getApiErrorMessage } from '@/utils/api'
import {
  buildCreateCardPayload,
  buildLookupById,
  getUserDisplayName,
  normalizeApiCard,
  normalizeApiCards,
} from '@/utils/cardApiAdapter'
import { DATA_CHANGE_KINDS, emitDataChange, subscribeDataChange } from '@/utils/dataEvents'

const MIN_LOADING_MS = 2000

export function useWalletCards() {
  const { user, isLoading: authLoading } = useAuth()
  const [cards, setCards] = useState([])
  const [cardTypes, setCardTypes] = useState([])
  const [cardStatuses, setCardStatuses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const holderName = useMemo(() => getUserDisplayName(user), [user])
  const userId = user?.id

  const typesById = useMemo(
    () => buildLookupById(cardTypes, 'card_type_id'),
    [cardTypes]
  )
  const statusesById = useMemo(
    () => buildLookupById(cardStatuses, 'card_status_id'),
    [cardStatuses]
  )

  useEffect(() => {
    if (authLoading) return

    let ignore = false

    if (!userId) {
      Promise.resolve().then(() => {
        if (ignore) return
        setCards([])
        setIsLoading(false)
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

    const startedAt = Date.now()

    Promise.all([
      listCards({ user_id: userId }),
      cardTypesService.list(),
      cardStatusesService.list(),
    ])
      .then(([rawCards, nextCardTypes, nextCardStatuses]) => {
        if (ignore) return

        setCardTypes(nextCardTypes)
        setCardStatuses(nextCardStatuses)
        setCards(normalizeApiCards(rawCards, nextCardTypes, nextCardStatuses, holderName))
      })
      .catch((err) => {
        if (!ignore) setError(getApiErrorMessage(err, 'Unable to load cards.'))
      })
      .finally(() => {
        if (ignore) return
        const elapsed = Date.now() - startedAt
        const remaining = Math.max(MIN_LOADING_MS - elapsed, 0)
        setTimeout(() => {
          if (!ignore) setIsLoading(false)
        }, remaining)
      })

    return () => {
      ignore = true
    }
  }, [authLoading, holderName, userId])

  const silentRefetch = useCallback(async () => {
    if (!userId) return
    try {
      const [rawCards, nextCardTypes, nextCardStatuses] = await Promise.all([
        listCards({ user_id: userId }),
        cardTypesService.list(),
        cardStatusesService.list(),
      ])
      setCardTypes(nextCardTypes)
      setCardStatuses(nextCardStatuses)
      setCards(normalizeApiCards(rawCards, nextCardTypes, nextCardStatuses, holderName))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to refresh cards.'))
    }
  }, [holderName, userId])

  useEffect(() => {
    return subscribeDataChange(() => {
      silentRefetch()
    })
  }, [silentRefetch])

  const addCard = useCallback(
    async (cardInput) => {
      if (!userId) {
        throw new Error('Sign in before adding a card.')
      }

      setIsSaving(true)
      setSaveError(null)

      try {
        const payload = buildCreateCardPayload({
          cardInput,
          userId,
          cardTypes,
          cardStatuses,
        })
        const createdCard = await createCard(payload)
        const normalizedCard = normalizeApiCard(
          createdCard,
          typesById,
          statusesById,
          holderName
        )

        setCards((currentCards) => {
          const next = normalizedCard.isMain
            ? currentCards.map((item) => ({
                ...item,
                isMain: false,
                source: { ...item.source, is_main: false },
              }))
            : currentCards
          return [...next, normalizedCard]
        })
        return normalizedCard
      } catch (err) {
        const message = getApiErrorMessage(err, err?.message || 'Unable to add card.')
        setSaveError(message)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [cardStatuses, cardTypes, holderName, statusesById, typesById, userId]
  )

  const updateWalletCard = useCallback(
    async (cardId, payload) => {
      setIsSaving(true)
      setSaveError(null)

      try {
        const updatedCard = await updateCard(cardId, payload)
        const normalizedCard = normalizeApiCard(
          updatedCard,
          typesById,
          statusesById,
          holderName
        )

        setCards((currentCards) =>
          currentCards.map((item) => (item.id === String(cardId) ? normalizedCard : item))
        )
        return normalizedCard
      } catch (err) {
        const message = getApiErrorMessage(err, err?.message || 'Unable to update card.')
        setSaveError(message)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [holderName, statusesById, typesById]
  )

  const setMainCard = useCallback(
    async (cardId) => {
      setIsSaving(true)
      setSaveError(null)

      let previousCards
      setCards((current) => {
        previousCards = current
        return current.map((item) => ({
          ...item,
          isMain: item.id === String(cardId),
          source: { ...item.source, is_main: item.id === String(cardId) },
        }))
      })

      try {
        const updatedCard = await setMainCardService(cardId)
        const normalizedCard = normalizeApiCard(updatedCard, typesById, statusesById, holderName)
        setCards((current) =>
          current.map((item) =>
            item.id === String(cardId)
              ? normalizedCard
              : { ...item, isMain: false, source: { ...item.source, is_main: false } }
          )
        )
        return normalizedCard
      } catch (err) {
        setCards(previousCards)
        const message = getApiErrorMessage(err, err?.message || 'Unable to set main card.')
        setSaveError(message)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    [holderName, statusesById, typesById]
  )

  const removeCard = useCallback(
    async (cardId) => {
      setIsSaving(true)
      setSaveError(null)

      const cardIdStr = String(cardId)
      let previousCards
      setCards((current) => {
        previousCards = current
        const removed = current.find((item) => item.id === cardIdStr)
        const remaining = current.filter((item) => item.id !== cardIdStr)
        if (removed?.isMain && remaining.length > 0) {
          const [first, ...rest] = remaining
          return [
            { ...first, isMain: true, source: { ...first.source, is_main: true } },
            ...rest,
          ]
        }
        return remaining
      })

      try {
        await deleteCardService(cardId)
        emitDataChange(DATA_CHANGE_KINDS.CARD)
      } catch (err) {
        setCards(previousCards)
        const message = getApiErrorMessage(err, err?.message || 'Unable to remove card.')
        setSaveError(message)
        throw err
      } finally {
        setIsSaving(false)
      }
    },
    []
  )

  return {
    cards,
    isLoading: authLoading || isLoading,
    isSaving,
    error,
    saveError,
    addCard,
    updateCard: updateWalletCard,
    setMainCard,
    removeCard,
  }
}
