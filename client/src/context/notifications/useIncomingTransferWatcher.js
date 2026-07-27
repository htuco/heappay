import { useCallback, useEffect, useRef } from 'react'
import { transactionsService } from '@/services/transactionsService'
import { loadBaseline, saveBaseline } from './storage'
import { CATEGORIES } from './categories'
import { formatAmount } from './format'
import { useVisibilityInterval } from './useVisibilityInterval'

const POLL_MS = 15_000
const PAGE_SIZE = 20
// Safety cap on how many pages a single poll will walk back. At PAGE_SIZE 20
// that covers 100 transactions newer than the baseline — far more than can
// realistically appear between two 15s polls, while bounding a cold-start or
// long-offline catch-up so the poll can't run away.
const MAX_PAGES = 5
const COMPLETED_STATUS_ID = 2
const REVERSED_STATUS_ID = 4

/**
 * Fetches transactions newest-first, paging forward until it has collected
 * every item with transaction_id > minId (i.e. the page's smallest id drops to
 * or below the baseline), or until MAX_PAGES is reached. Returns the combined
 * list. Avoids the "only page 1 examined" blind spot where a burst of more than
 * PAGE_SIZE transactions between polls would push the baseline past unseen
 * incoming transfers.
 */
async function collectSince(minId) {
	const collected = []
	for (let page = 1; page <= MAX_PAGES; page++) {
		const res = await transactionsService.list({ page, pageSize: PAGE_SIZE })
		const items = Array.isArray(res?.items) ? res.items : []
		if (items.length === 0) break
		collected.push(...items)
		const smallestId = items.reduce(
			(acc, t) => Math.min(acc, t.transaction_id),
			Number.POSITIVE_INFINITY,
		)
		// Once a page reaches the baseline (or there's no next page), stop.
		if (smallestId <= minId || items.length < PAGE_SIZE) break
	}
	return collected
}

function senderLabel(tx) {
	const s = tx?.sender
	if (!s) return 'someone'
	return s.full_name || [s.first_name, s.last_name].filter(Boolean).join(' ') || 'someone'
}

/**
 * Polls /transactions every 15s for incoming completed transfers and emits
 * a notification per new item where the user is the recipient AND the sender
 * is a different user.
 *
 * Baseline: max transaction_id seen, persisted per user. The first poll
 * establishes the baseline silently — older transactions are not replayed.
 */
export function useIncomingTransferWatcher({ userId, notify }) {
	const baselineRef = useRef(null)
	const establishedRef = useRef(false)
	// Snapshot of (transaction_id → status_id) for the user's outgoing
	// transactions, used to detect 2→4 (Completed→Reversed) transitions that
	// indicate a refund was approved server-side.
	const outgoingStatusRef = useRef(new Map())

	// Reset per-user state on user swap so the new user's baseline is
	// established fresh, not inherited from the previous user.
	useEffect(() => {
		baselineRef.current = null
		establishedRef.current = false
		outgoingStatusRef.current = new Map()
	}, [userId])

	const tick = useCallback(async () => {
		if (!userId) return

		// Load persisted baseline on first run for this user.
		if (baselineRef.current === null) {
			baselineRef.current = loadBaseline(userId, 'incoming_tx') ?? 0
		}

		// On the first (snapshot) poll we only need page 1 to establish the
		// baseline. After that, page back to the baseline so a burst larger than
		// one page can't slip newer transfers past us.
		let items
		try {
			items = establishedRef.current
				? await collectSince(baselineRef.current)
				: (await transactionsService.list({ page: 1, pageSize: PAGE_SIZE }))?.items
		} catch {
			return
		}

		items = Array.isArray(items) ? items : []

		// First successful poll for this user: just snapshot — no notifications.
		// Done even when the list is empty so the watcher is armed; otherwise the
		// very first transaction to ever appear would be swallowed as "baseline".
		if (!establishedRef.current) {
			establishedRef.current = true
			baselineRef.current = items.reduce(
				(acc, t) => Math.max(acc, t.transaction_id),
				baselineRef.current,
			)
			saveBaseline(userId, 'incoming_tx', baselineRef.current)
			for (const t of items) {
				if (t.sender?.user_id === userId) {
					outgoingStatusRef.current.set(t.transaction_id, t.status_id)
				}
			}
			return
		}

		if (items.length === 0) return

		const maxId = items.reduce((acc, t) => Math.max(acc, t.transaction_id), 0)

		const incoming = items
			.filter((t) => t.transaction_id > baselineRef.current)
			.filter((t) => t.status_id === COMPLETED_STATUS_ID)
			.filter((t) => t.recipient?.user_id === userId)
			.filter((t) => t.sender && t.sender.user_id !== userId)
			// oldest first so toasts queue in chronological order
			.sort((a, b) => a.transaction_id - b.transaction_id)

		for (const tx of incoming) {
			notify({
				type: 'success',
				category: CATEGORIES.PAYMENT_RECEIVED,
				message: `${formatAmount(tx.amount)} received from ${senderLabel(tx)}.`,
				link: { route: '/transactions', modal: { kind: 'transaction', id: tx.transaction_id } },
				surface: 'panel',
				dedupKey: `tx:${tx.transaction_id}:received`,
			})
		}

		// Detect refund-approved on the user's outgoing transactions: status
		// flips from Completed (2) to Reversed (4). The decline path doesn't
		// touch the transaction so it can't be detected here without a
		// dedicated /requests/user endpoint open to the requester (out of
		// scope for this ticket — requires a backend change).
		for (const tx of items) {
			if (tx.sender?.user_id !== userId) continue
			const prev = outgoingStatusRef.current.get(tx.transaction_id)
			outgoingStatusRef.current.set(tx.transaction_id, tx.status_id)
			if (prev === COMPLETED_STATUS_ID && tx.status_id === REVERSED_STATUS_ID) {
				notify({
					type: 'success',
					category: CATEGORIES.REFUND_APPROVED,
					message: `Your refund for ${formatAmount(tx.amount)} was approved.`,
					link: { route: '/transactions', modal: { kind: 'transaction', id: tx.transaction_id } },
					surface: 'panel',
					dedupKey: `tx:${tx.transaction_id}:refund_approved`,
				})
			}
		}

		if (maxId > baselineRef.current) {
			baselineRef.current = maxId
			saveBaseline(userId, 'incoming_tx', maxId)
		}
	}, [userId, notify])

	useVisibilityInterval(tick, POLL_MS, Boolean(userId))
}
