import { useCallback, useEffect, useRef } from 'react'
import { recurringPaymentsService } from '@/services/recurringPaymentsService'
import { CATEGORIES } from './categories'
import { formatAmount } from './format'
import { useVisibilityInterval } from './useVisibilityInterval'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'

const POLL_MS = 30_000

function recipientLabel(rule) {
	const r = rule?.recipient
	if (!r) return 'recipient'
	if (r.first_name || r.last_name) return [r.first_name, r.last_name].filter(Boolean).join(' ')
	return r.email || 'recipient'
}

/**
 * Polls /recurring-payments every 30s. Emits:
 *  - BILL_FAILED when last_run_failed flips true (scheduler couldn't deduct)
 *  - BILL_PAID  when next_due_at advances and last_run_failed is false (payment went through)
 */
export function useRecurringPaymentWatcher({ userId, notify }) {
  const { formatMoney } = useDisplayCurrency()
	// Map of recurring_payment_id → { last_run_failed, next_due_at }
	const snapshotRef = useRef(new Map())
	const establishedRef = useRef(false)

	useEffect(() => {
		snapshotRef.current = new Map()
		establishedRef.current = false
	}, [userId])

	const tick = useCallback(async () => {
		if (!userId) return
		let rules
		try {
			rules = await recurringPaymentsService.list()
		} catch {
			return
		}
		if (!Array.isArray(rules)) return

		if (!establishedRef.current) {
			establishedRef.current = true
			for (const r of rules) {
				snapshotRef.current.set(r.recurring_payment_id, {
					last_run_failed: r.last_run_failed,
					next_due_at: r.next_due_at,
				})
			}
			return
		}

		for (const r of rules) {
			const prev = snapshotRef.current.get(r.recurring_payment_id)

			if (!prev) {
				// New rule added this session — just snapshot it
				snapshotRef.current.set(r.recurring_payment_id, {
					last_run_failed: r.last_run_failed,
					next_due_at: r.next_due_at,
				})
				continue
			}

			const failedNow = r.last_run_failed && !prev.last_run_failed
			const dueAdvanced = r.next_due_at !== prev.next_due_at

			if (failedNow) {
				notify({
					type: 'error',
					category: CATEGORIES.BILL_FAILED,
					message: `Recurring payment of ${formatAmount(r.amount, formatMoney)} to ${recipientLabel(r)} failed. Check your balance.`,
					link: { route: '/recurring' },
					surface: 'both',
					dedupKey: `bill:${r.recurring_payment_id}:failed:${r.next_due_at}`,
				})
			} else if (dueAdvanced && !r.last_run_failed) {
				notify({
					type: 'success',
					category: CATEGORIES.BILL_PAID,
					message: `Recurring payment of ${formatAmount(r.amount, formatMoney)} to ${recipientLabel(r)} was sent.`,
					link: { route: '/recurring' },
					surface: 'panel',
					dedupKey: `bill:${r.recurring_payment_id}:paid:${prev.next_due_at}`,
				})
			}

			snapshotRef.current.set(r.recurring_payment_id, {
				last_run_failed: r.last_run_failed,
				next_due_at: r.next_due_at,
			})
		}
	}, [userId, notify, formatMoney])

	useVisibilityInterval(tick, POLL_MS, Boolean(userId))
}
