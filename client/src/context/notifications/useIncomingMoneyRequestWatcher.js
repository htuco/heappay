import { useCallback, useEffect, useRef } from 'react'
import { transactionsService } from '@/services/transactionsService'
import { loadBaseline, saveBaseline } from './storage'
import { CATEGORIES } from './categories'
import { formatAmount } from './format'
import { useVisibilityInterval } from './useVisibilityInterval'

const POLL_MS = 15_000
const PAGE_SIZE = 20
const MAX_PAGES = 5

async function collectIncomingSince(minId) {
	const collected = []
	for (let page = 1; page <= MAX_PAGES; page++) {
		const res = await transactionsService.listIncomingMoneyRequests({
			page,
			pageSize: PAGE_SIZE,
		})
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
 * Polls incoming money requests for any verified user and emits a notification
 * when a new pending request appears. No staff gate — this is peer-to-peer.
 *
 * Baseline = max request_id seen; established silently on first poll.
 */
export function useIncomingMoneyRequestWatcher({ userId, notify }) {
	const baselineRef = useRef(null)
	const establishedRef = useRef(false)

	useEffect(() => {
		baselineRef.current = null
		establishedRef.current = false
	}, [userId])

	const tick = useCallback(async () => {
		if (!userId) return

		if (baselineRef.current === null) {
			baselineRef.current = loadBaseline(userId, 'incoming_money_requests') ?? 0
		}

		let items
		try {
			items = establishedRef.current
				? await collectIncomingSince(baselineRef.current)
				: (
						await transactionsService.listIncomingMoneyRequests({
							page: 1,
							pageSize: PAGE_SIZE,
						})
					)?.items
		} catch {
			return
		}

		items = Array.isArray(items) ? items : []

		if (!establishedRef.current) {
			establishedRef.current = true
			const maxId = items.reduce(
				(acc, r) => Math.max(acc, r.request_id),
				baselineRef.current,
			)
			baselineRef.current = maxId
			saveBaseline(userId, 'incoming_money_requests', maxId)
			return
		}

		if (items.length === 0) return

		const maxId = items.reduce((acc, r) => Math.max(acc, r.request_id), 0)
		const fresh = items
			.filter((r) => r.request_id > baselineRef.current)
			.sort((a, b) => a.request_id - b.request_id)

		for (const req of fresh) {
			const amount = formatAmount(req.money_request_detail?.amount)
			const who =
				req.money_request_detail?.requester_name ||
				req.requester_name ||
				'someone'
			notify({
				type: 'warning',
				category: CATEGORIES.MONEY_REQUEST_RECEIVED,
				message: amount
					? `${who} requested ${amount} from you.`
					: `${who} sent you a money request.`,
				link: { route: '/transactions' },
				surface: 'both',
				dedupKey: `moneyreq:${req.request_id}:pending`,
			})
		}

		if (maxId > baselineRef.current) {
			baselineRef.current = maxId
			saveBaseline(userId, 'incoming_money_requests', maxId)
		}
	}, [userId, notify])

	useVisibilityInterval(tick, POLL_MS, Boolean(userId))
}
