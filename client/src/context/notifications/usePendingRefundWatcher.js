import { useCallback, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { selectAuthUser } from '@/store/slices/authSlice'
import transactionsService from '@/services/transactionsService'
import { loadBaseline, saveBaseline } from './storage'
import { CATEGORIES } from './categories'
import { useVisibilityInterval } from './useVisibilityInterval'

const POLL_MS = 30_000
const PAGE_SIZE = 20
const STAFF_ROLES = new Set(['admin', 'support', 'manager'])

function formatAmount(amount) {
	if (amount == null) return ''
	const n = Number.parseFloat(amount)
	if (Number.isNaN(n)) return String(amount)
	return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/**
 * Polls /requests/refunds/pending every 30s for staff users and emits a
 * notification when a new pending refund request appears.
 *
 * Gated by role — non-staff users skip entirely.
 * Baseline = max request_id seen; established silently on first poll.
 */
export function usePendingRefundWatcher({ userId, notify }) {
	const user = useSelector(selectAuthUser)
	const isStaff = STAFF_ROLES.has(user?.role_name)
	const baselineRef = useRef(null)
	const establishedRef = useRef(false)

	useEffect(() => {
		baselineRef.current = null
		establishedRef.current = false
	}, [userId])

	const tick = useCallback(async () => {
		if (!userId || !isStaff) return

		if (baselineRef.current === null) {
			baselineRef.current = loadBaseline(userId, 'pending_refunds') ?? 0
		}

		let page
		try {
			page = await transactionsService.listPendingRefunds({ page: 1, pageSize: PAGE_SIZE })
		} catch {
			return
		}

		const items = Array.isArray(page?.items) ? page.items : []
		if (items.length === 0) return

		const maxId = items.reduce((acc, r) => Math.max(acc, r.request_id), 0)

		if (!establishedRef.current) {
			establishedRef.current = true
			baselineRef.current = maxId
			saveBaseline(userId, 'pending_refunds', maxId)
			return
		}

		const fresh = items
			.filter((r) => r.request_id > baselineRef.current)
			.sort((a, b) => a.request_id - b.request_id)

		for (const req of fresh) {
			const amount = formatAmount(req.refund_detail?.transaction_amount)
			const who = req.requester_name || 'a user'
			notify({
				type: 'warning',
				category: CATEGORIES.REFUND_REQUESTED,
				message: amount
					? `${who} requested a refund of ${amount}.`
					: `${who} submitted a refund request.`,
				link: { route: '/support/tickets' },
				surface: 'panel',
				dedupKey: `refund:${req.request_id}:pending`,
			})
		}

		if (maxId > baselineRef.current) {
			baselineRef.current = maxId
			saveBaseline(userId, 'pending_refunds', maxId)
		}
	}, [userId, isStaff, notify])

	useVisibilityInterval(tick, POLL_MS, Boolean(userId) && isStaff)
}
