import { useEffect, useState } from 'react'
import cardTypesService from '@/services/cardTypesService'
import { maskCardNumber } from '@/utils/cardMask'

let cachedTypes = null
let inFlight = null

function fetchCardTypes() {
  if (cachedTypes) return Promise.resolve(cachedTypes)
  if (inFlight) return inFlight
  inFlight = cardTypesService
    .list()
    .then((rows) => {
      cachedTypes = Array.isArray(rows) ? rows : []
      return cachedTypes
    })
    .catch(() => {
      cachedTypes = []
      return cachedTypes
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/**
 * Hook that returns:
 *   - resolveBrand(card_type_id) -> brand key string (e.g. 'visa', 'amex')
 *   - maskCard(card) -> brand-aware masked display string for a card-like object
 *
 * Cards from the raw API expose card_type_id + last_four; this hook turns those
 * into a properly formatted mask without each caller having to fetch card types.
 */
export function useCardBrandResolver() {
  const [typesById, setTypesById] = useState(() => {
    if (!cachedTypes) return {}
    return Object.fromEntries(cachedTypes.map((t) => [t.card_type_id, t]))
  })

  useEffect(() => {
    let cancelled = false
    fetchCardTypes().then((rows) => {
      if (cancelled) return
      setTypesById(Object.fromEntries(rows.map((t) => [t.card_type_id, t])))
    })
    return () => {
      cancelled = true
    }
  }, [])

  function resolveBrand(cardTypeId) {
    if (cardTypeId == null) return null
    const type = typesById[cardTypeId]
    return type?.vendor ?? null
  }

  function maskCard(card) {
    if (!card) return ''
    const brand =
      card.brand ?? card.vendor ?? resolveBrand(card.card_type_id) ?? null
    const last4 = card.last_four ?? card.lastFour ?? card.masked_card_number
    return maskCardNumber(last4, { brand })
  }

  return { resolveBrand, maskCard, typesById }
}
