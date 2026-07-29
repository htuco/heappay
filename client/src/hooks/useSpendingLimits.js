import { useCallback, useEffect, useState } from 'react'
import {
  createCardMemberSpendingLimit,
  createCardSpendingLimit,
  createSpendingLimit,
  deleteCardMemberSpendingLimit,
  deleteCardSpendingLimit,
  deleteSpendingLimit,
  listCardMemberSpendingLimits,
  listCardSpendingLimits,
  listSpendingLimits,
  updateCardMemberSpendingLimit,
  updateCardSpendingLimit,
  updateSpendingLimit,
} from '@/services/familyService'

/**
 * Generic list/create/update/remove state for a spending-limit-rule list,
 * parameterized by the three backend API shapes (per-dependent's own card,
 * a shared card's overall cap, one member's cap on a shared card) so
 * `SpendingLimitRuleList` can stay a single controlled component driven by
 * whichever of these hooks the caller uses.
 */
function useRuleListState({ enabled, list, create: createFn, update: updateFn, remove: removeFn }) {
  const [rules, setRules] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!enabled) return
    setIsLoading(true)
    try {
      const data = await list()
      setRules(data)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function create(payload) {
    const rule = await createFn(payload)
    setRules((prev) => [...prev, rule])
    return rule
  }

  async function update(spendingLimitRuleId, payload) {
    const rule = await updateFn(spendingLimitRuleId, payload)
    setRules((prev) =>
      prev.map((r) => (r.spending_limit_rule_id === rule.spending_limit_rule_id ? rule : r)),
    )
    return rule
  }

  async function remove(spendingLimitRuleId) {
    await removeFn(spendingLimitRuleId)
    setRules((prev) => prev.filter((r) => r.spending_limit_rule_id !== spendingLimitRuleId))
  }

  return { rules, isLoading, error, refresh, create, update, remove }
}

/** A dependent's own spending-limit rules (on any card they own). */
export function useSpendingLimits(dependentUserId) {
  return useRuleListState({
    enabled: Boolean(dependentUserId),
    list: () => listSpendingLimits(dependentUserId),
    create: (payload) => createSpendingLimit(dependentUserId, payload),
    update: (ruleId, payload) => updateSpendingLimit(dependentUserId, ruleId, payload),
    remove: (ruleId) => deleteSpendingLimit(dependentUserId, ruleId),
  })
}

/** The guardian's overall cap on a shared card. */
export function useCardSpendingLimits(cardId) {
  return useRuleListState({
    enabled: Boolean(cardId),
    list: () => listCardSpendingLimits(cardId),
    create: (payload) => createCardSpendingLimit(cardId, payload),
    update: (ruleId, payload) => updateCardSpendingLimit(cardId, ruleId, payload),
    remove: (ruleId) => deleteCardSpendingLimit(cardId, ruleId),
  })
}

/** One member's own cap on a shared card. */
export function useCardMemberSpendingLimits(cardId, dependentUserId) {
  return useRuleListState({
    enabled: Boolean(cardId) && Boolean(dependentUserId),
    list: () => listCardMemberSpendingLimits(cardId, dependentUserId),
    create: (payload) => createCardMemberSpendingLimit(cardId, dependentUserId, payload),
    update: (ruleId, payload) => updateCardMemberSpendingLimit(cardId, dependentUserId, ruleId, payload),
    remove: (ruleId) => deleteCardMemberSpendingLimit(cardId, dependentUserId, ruleId),
  })
}

export default useSpendingLimits
