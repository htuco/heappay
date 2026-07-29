import { useCallback, useEffect, useState } from 'react'
import {
  createSpendingLimit,
  deleteSpendingLimit,
  listSpendingLimits,
  updateSpendingLimit,
} from '@/services/familyService'

/**
 * Spending-limit rules for one dependent, with optimistic local list
 * mutation on create/update/delete.
 */
export function useSpendingLimits(dependentUserId) {
  const [rules, setRules] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!dependentUserId) return
    setIsLoading(true)
    try {
      const data = await listSpendingLimits(dependentUserId)
      setRules(data)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [dependentUserId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function create(payload) {
    const rule = await createSpendingLimit(dependentUserId, payload)
    setRules((prev) => [...prev, rule])
    return rule
  }

  async function update(spendingLimitRuleId, payload) {
    const rule = await updateSpendingLimit(dependentUserId, spendingLimitRuleId, payload)
    setRules((prev) =>
      prev.map((r) => (r.spending_limit_rule_id === rule.spending_limit_rule_id ? rule : r)),
    )
    return rule
  }

  async function remove(spendingLimitRuleId) {
    await deleteSpendingLimit(dependentUserId, spendingLimitRuleId)
    setRules((prev) => prev.filter((r) => r.spending_limit_rule_id !== spendingLimitRuleId))
  }

  return { rules, isLoading, error, refresh, create, update, remove }
}

export default useSpendingLimits
