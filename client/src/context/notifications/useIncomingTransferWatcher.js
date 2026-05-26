import { useCallback, useEffect, useRef } from 'react'
import { transactionsService } from '@/services/transactionsService'
import { loadBaseline, saveBaseline } from './storage'
import { CATEGORIES } from './categories'
import { useVisibilityInterval } from './useVisibilityInterval'

const POLL_MS = 15_000
const PAGE_SIZE = 20
const COMPLETED_STATUS_ID = 2

function senderLabel(tx) {
	const s = tx?.sender
	if (!s) return 'someone'
	return s.full_name || [s.first_name, s.last_name].filter(Boolean).join(' ') || 'someone'
}

function formatAmount(amount) {
	const n = Number.parseFloat(amount ?? '0')
	if (Number.isNaN(n)) return String(amount ?? '')
	return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
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

	// Reset per-user state on user swap so the new user's baseline is
	// established fresh, not inherited from the previous user.
	useEffect(() => {
		baselineRef.current = null
		establishedRef.current = false
	}, [userId])

	const tick = useCallback(async () => {
		if (!userId) return

		// Load persisted baseline on first run for this user.
		if (baselineRef.current === null) {
			baselineRef.current = loadBaseline(userId, 'incoming_tx') ?? 0
		}

		let page
		try {
			page = await transactionsService.list({ page: 1, pageSize: PAGE_SIZE })
		} catch {
			return
		}

		const items = Array.isArray(page?.items) ? page.items : []
		if (items.length === 0) return

		const maxId = items.reduce((acc, t) => Math.max(acc, t.transaction_id), 0)

		// First successful poll for this user: just set the high-water-mark.
		if (!establishedRef.current) {
			establishedRef.current = true
			baselineRef.current = maxId
			saveBaseline(userId, 'incoming_tx', maxId)
			return
		}

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
				link: { route: '/payments', modal: { kind: 'transaction', id: tx.transaction_id } },
				surface: 'panel',
				dedupKey: `tx:${tx.transaction_id}:received`,
			})
		}

		if (maxId > baselineRef.current) {
			baselineRef.current = maxId
			saveBaseline(userId, 'incoming_tx', maxId)
		}
	}, [userId, notify])

	useVisibilityInterval(tick, POLL_MS, Boolean(userId))
}
