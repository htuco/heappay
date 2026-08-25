import { useCallback, useEffect, useRef } from 'react'
import { transactionsService } from '@/services/transactionsService'
import { listCards } from '@/services/cardsService'
import { getWalletBalance } from '@/services/walletService'
import { loadBaseline, saveBaseline } from './storage'
import { CATEGORIES } from './categories'
import { formatAmount } from './format'
import { useVisibilityInterval } from './useVisibilityInterval'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'

const POLL_MS = 15_000
const PAGE_SIZE = 20
// Safety cap on how many pages a single poll walks back — mirrors the incoming
// watcher. 5 pages × 20 = 100 items newer than the baseline, far more than can
// appear between two 15s polls, while bounding a cold-start catch-up.
const MAX_PAGES = 5
const PENDING_STATUS_ID = 1
const COMPLETED_STATUS_ID = 2

/**
 * Fetches transactions newest-first, paging forward until every item newer than
 * the baseline is collected (or MAX_PAGES is hit). Same shape as the incoming
 * watcher's collectSince so a burst larger than one page can't slip past.
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
		if (smallestId <= minId || items.length < PAGE_SIZE) break
	}
	return collected
}

/**
 * Current spendable balance: wallet (unallocated) pool + sum of active card
 * balances. Card balances are already net of escrow holds (the debit is applied
 * on create), so a fresh read here reflects the balance *after* the outflow —
 * matching the server's outflow-email total. Returns null on failure so the
 * caller can skip the balance line rather than show a wrong number.
 */
async function currentTotalBalance(userId) {
	try {
		// Scope the card read to the user: `GET /cards` returns *every* user's
		// cards when a staff caller omits `user_id`, which would sum the whole
		// platform's balances into an admin's own outflow alert.
		const [wallet, cardsRes] = await Promise.all([
			getWalletBalance(),
			listCards({ user_id: userId }),
		])
		const cards = Array.isArray(cardsRes?.items)
			? cardsRes.items
			: Array.isArray(cardsRes)
				? cardsRes
				: []
		const cardsTotal = cards.reduce((sum, c) => {
			const n = Number(c?.balance)
			return sum + (Number.isNaN(n) ? 0 : n)
		}, 0)
		const walletNum = Number(wallet)
		return (Number.isNaN(walletNum) ? 0 : walletNum) + cardsTotal
	} catch {
		return null
	}
}

/**
 * Polls /transactions every 15s and, when one of the user's *outgoing*
 * transactions settles (pending → completed), emits an outflow notification
 * carrying the user's current balance and a deep link to the transaction.
 *
 * Baseline: max transaction_id seen, persisted per user under a dedicated key.
 * A per-tx status snapshot detects the pending→completed transition so the
 * alert fires on settle, not on create (apply-on-settle). Self-transfers
 * (sender === recipient) don't change net balance and are skipped.
 */
export function useOutflowWatcher({ userId, notify }) {
  const { formatMoney } = useDisplayCurrency()
	const baselineRef = useRef(null)
	const establishedRef = useRef(false)
	// (transaction_id → status_id) for the user's outgoing transactions, used to
	// detect the 1→2 (pending → completed) settle transition.
	const outgoingStatusRef = useRef(new Map())

	useEffect(() => {
		baselineRef.current = null
		establishedRef.current = false
		outgoingStatusRef.current = new Map()
	}, [userId])

	const tick = useCallback(async () => {
		if (!userId) return

		if (baselineRef.current === null) {
			baselineRef.current = loadBaseline(userId, 'outflow') ?? 0
		}

		let items
		try {
			items = establishedRef.current
				? await collectSince(baselineRef.current)
				: (await transactionsService.list({ page: 1, pageSize: PAGE_SIZE }))?.items
		} catch {
			return
		}

		items = Array.isArray(items) ? items : []

		const isOutgoing = (t) =>
			t.sender?.user_id === userId && t.recipient?.user_id !== userId

		// First successful poll for this user: snapshot only — no notifications, so
		// transactions that were already completed before this session don't replay.
		if (!establishedRef.current) {
			establishedRef.current = true
			baselineRef.current = items.reduce(
				(acc, t) => Math.max(acc, t.transaction_id),
				baselineRef.current,
			)
			saveBaseline(userId, 'outflow', baselineRef.current)
			for (const t of items) {
				if (isOutgoing(t)) {
					outgoingStatusRef.current.set(t.transaction_id, t.status_id)
				}
			}
			return
		}

		if (items.length === 0) return

		const maxId = items.reduce((acc, t) => Math.max(acc, t.transaction_id), 0)

		// Detect settle: an outgoing tx whose status flips to completed, either
		// from a previously-seen pending state or appearing already completed on a
		// tx newer than the baseline (fast settle between two polls).
		const settled = []
		for (const tx of items) {
			if (!isOutgoing(tx)) continue
			const prev = outgoingStatusRef.current.get(tx.transaction_id)
			const isNew = prev === undefined
			outgoingStatusRef.current.set(tx.transaction_id, tx.status_id)
			if (tx.status_id !== COMPLETED_STATUS_ID) continue
			const transitionedFromPending = prev === PENDING_STATUS_ID
			const newlyCompleted =
				isNew && tx.transaction_id > baselineRef.current
			if (transitionedFromPending || newlyCompleted) {
				settled.push(tx)
			}
		}

		if (settled.length > 0) {
			// oldest first so toasts queue in chronological order
			settled.sort((a, b) => a.transaction_id - b.transaction_id)
			const balance = await currentTotalBalance(userId)
			const balanceLine =
				balance == null
					? 'You had an outflow.'
					: `You had an outflow. Your current balance is ${formatAmount(balance, formatMoney)}.`
			for (const tx of settled) {
				notify({
					type: 'warning',
					category: CATEGORIES.OUTFLOW_ALERT,
					message: balanceLine,
					link: {
						route: '/payments',
						modal: { kind: 'transaction', id: tx.transaction_id },
					},
					surface: 'both',
					dedupKey: `tx:${tx.transaction_id}:outflow`,
				})
			}
		}

		if (maxId > baselineRef.current) {
			baselineRef.current = maxId
			saveBaseline(userId, 'outflow', maxId)
		}
	}, [userId, notify, formatMoney])

	useVisibilityInterval(tick, POLL_MS, Boolean(userId))
}
