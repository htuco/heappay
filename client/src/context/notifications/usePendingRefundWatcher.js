import { useCallback, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { selectAuthUser } from '@/store/slices/authSlice'
import transactionsService from '@/services/transactionsService'
import { loadBaseline, saveBaseline } from './storage'
import { CATEGORIES } from './categories'
import { formatAmount } from './format'
import { useVisibilityInterval } from './useVisibilityInterval'

const POLL_MS = 30_000
const PAGE_SIZE = 20
// See useIncomingTransferWatcher: bound how far back a single poll walks while
// still covering more new requests than can realistically arrive between polls.
const MAX_PAGES = 5
const STAFF_ROLES = new Set(['admin', 'support'])

/**
 * Pages forward (newest-first) collecting pending refunds with request_id >
 * minId, until a page reaches the baseline or MAX_PAGES is hit. Prevents a
 * burst of more than PAGE_SIZE new requests from pushing the baseline past
 * unseen ones.
 */
async function collectPendingSince(minId) {
	const collected = []
	for (let page = 1; page <= MAX_PAGES; page++) {
		const res = await transactionsService.listPendingRefunds({ page, pageSize: PAGE_SIZE })
		const items = Array.isArray(res?.items) ? res.items : []
		if (items.length === 0) break
		collected.push(...items)
		const smallestId = items.reduce(
			(acc, r) => Math.min(acc, r.request_id),
			Number.POSITIVE_INFINITY,
		)
		if (smallestId <= minId || items.length < PAGE_SIZE) break
	}
	return collected
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

		let items
		try {
			items = establishedRef.current
				? await collectPendingSince(baselineRef.current)
				: (await transactionsService.listPendingRefunds({ page: 1, pageSize: PAGE_SIZE }))?.items
		} catch {
			return
		}

		items = Array.isArray(items) ? items : []

		// First successful poll just establishes the baseline (even when empty,
		// so the watcher is armed) — existing requests are not replayed. An empty
		// first poll leaves the baseline at 0, so the next request that appears
		// is correctly treated as new.
		if (!establishedRef.current) {
			establishedRef.current = true
			const maxId = items.reduce((acc, r) => Math.max(acc, r.request_id), baselineRef.current)
			baselineRef.current = maxId
			saveBaseline(userId, 'pending_refunds', maxId)
			return
		}

		if (items.length === 0) return

		const maxId = items.reduce((acc, r) => Math.max(acc, r.request_id), 0)

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
				surface: 'both',
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
