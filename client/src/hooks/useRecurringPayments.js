import { useCallback, useEffect, useState } from 'react'

import { recurringPaymentsService } from '@/services/recurringPaymentsService'
import { listCards } from '@/services/cardsService'
import { useAuth } from '@/hooks/useAuth'

/**
 * Owns the recurring-payments read model and its create / edit / cancel writes.
 *
 * Lifted out of `RecurringPaymentList` so the page can derive its summary cards
 * from the same payload instead of fetching `/recurring-payments` twice. The
 * mutations resolve to `true` only when the write landed, so callers can keep a
 * dialog open on failure.
 */
export function useRecurringPayments() {
  const { user } = useAuth()
  const currentUserId = user?.user_id ?? user?.id

  const [rules, setRules] = useState([])
  const [cards, setCards] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isMutating, setIsMutating] = useState(false)
  const [mutationError, setMutationError] = useState(null)

  const load = useCallback(async () => {
    // `GET /cards` only self-scopes for non-staff callers: an admin with no
    // `user_id` param gets *every* user's cards, which would leak them into the
    // "Pay from" picker. Always scope explicitly — and wait for the id, because
    // axios drops an `undefined` param and we'd be back to the unscoped call.
    if (!currentUserId) return

    try {
      const [rulesData, cardsData] = await Promise.all([
        recurringPaymentsService.list(),
        listCards({ user_id: currentUserId }).catch(() => []),
      ])
      setRules(Array.isArray(rulesData) ? rulesData : [])
      const cardItems = cardsData?.items ?? cardsData
      setCards(Array.isArray(cardItems) ? cardItems : [])
    } catch {
      setError('Could not load recurring payments.')
    } finally {
      setIsLoading(false)
    }
  }, [currentUserId])

  useEffect(() => {
    load()
  }, [load])

  const clearMutationError = useCallback(() => setMutationError(null), [])

  // Resolves to the created rule (truthy) so the create wizard's success screen
  // can show the server-derived `next_due_at`; `null` on failure so callers can
  // keep the dialog open.
  const createRule = useCallback(async (payload) => {
    setIsMutating(true)
    setMutationError(null)
    try {
      const created = await recurringPaymentsService.create(payload)
      setRules((prev) => [created, ...prev])
      return created
    } catch (err) {
      setMutationError(err?.message || 'Failed to create recurring payment.')
      return null
    } finally {
      setIsMutating(false)
    }
  }, [])

  const updateRule = useCallback(async (recurringPaymentId, payload) => {
    setIsMutating(true)
    setMutationError(null)
    try {
      const updated = await recurringPaymentsService.update(recurringPaymentId, payload)
      setRules((prev) =>
        prev.map((rule) =>
          rule.recurring_payment_id === updated.recurring_payment_id ? updated : rule,
        ),
      )
      return true
    } catch (err) {
      setMutationError(err?.message || 'Failed to update recurring payment.')
      return false
    } finally {
      setIsMutating(false)
    }
  }, [])

  const cancelRule = useCallback(async (recurringPaymentId) => {
    setIsMutating(true)
    setMutationError(null)
    try {
      await recurringPaymentsService.cancel(recurringPaymentId)
      // Cancelled rules drop out of the list endpoint, so drop them here too.
      setRules((prev) =>
        prev.filter((rule) => rule.recurring_payment_id !== recurringPaymentId),
      )
      return true
    } catch (err) {
      setMutationError(err?.message || 'Failed to cancel recurring payment.')
      return false
    } finally {
      setIsMutating(false)
    }
  }, [])

  return {
    rules,
    cards,
    currentUserId,
    isLoading,
    error,
    isMutating,
    mutationError,
    clearMutationError,
    createRule,
    updateRule,
    cancelRule,
    refresh: load,
  }
}

export default useRecurringPayments
