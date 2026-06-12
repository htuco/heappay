import { useCallback, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { getMe } from '@/services/authService'
import { listCards } from '@/services/cardsService'
import { CATEGORIES } from './categories'
import { cardLabel } from './format'
import { useVisibilityInterval } from './useVisibilityInterval'

const POLL_MS = 30_000
const SELF_ACTION_WINDOW_MS = 5_000

const selectRefStatuses = (state) => ({
	userStatuses: state.referenceData?.userStatuses ?? [],
	cardStatuses: state.referenceData?.cardStatuses ?? [],
})

function statusName(list, id, key) {
	const entry = list.find((s) => s[key] === id)
	return entry?.status_name ?? null
}

function isoDay(ts = Date.now()) {
	const d = new Date(ts)
	return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Polls /auth/me and /cards every 30s (and on tab focus). Diffs against the
 * last in-memory snapshot to detect:
 *   - user status change → account_suspended / account_reactivated
 *   - card status change → card_blocked / card_unblocked / card-expired/cancelled
 *
 * Snapshots are seeded on first poll, so no notification fires for state that
 * already existed at login. Self-initiated card changes (user just blocked
 * their own card from the UI) are suppressed for 5s after a DATA_CHANGE_KINDS.CARD
 * emit — that signal is set externally via `markSelfCardAction()`.
 */
export function useAccountEventsWatcher({ userId, notify, selfActionRef }) {
	const { userStatuses, cardStatuses } = useSelector(selectRefStatuses)

	const userStatusRef = useRef(null)
	const cardSnapshotRef = useRef(null) // Map<card_id, status_id>
	const establishedRef = useRef(false)

	useEffect(() => {
		userStatusRef.current = null
		cardSnapshotRef.current = null
		establishedRef.current = false
	}, [userId])

	const tick = useCallback(async () => {
		if (!userId) return

		let me
		let rawCards
		try {
			;[me, rawCards] = await Promise.all([
				getMe(),
				listCards({ user_id: userId }),
			])
		} catch {
			return
		}

		const cards = Array.isArray(rawCards) ? rawCards : (rawCards?.data ?? rawCards?.items ?? [])

		const nextUserStatus = me?.status_id ?? null
		const nextCardMap = new Map(cards.map((c) => [c.card_id, c.status_id]))

		// First successful poll for this user just snapshots — no notify.
		if (!establishedRef.current) {
			establishedRef.current = true
			userStatusRef.current = nextUserStatus
			cardSnapshotRef.current = nextCardMap
			return
		}

		// --- User status diff ---
		if (
			userStatusRef.current !== null &&
			nextUserStatus !== null &&
			userStatusRef.current !== nextUserStatus
		) {
			const name = statusName(userStatuses, nextUserStatus, 'user_status_id')
			if (name === 'suspended') {
				notify({
					type: 'error',
					category: CATEGORIES.ACCOUNT_SUSPENDED,
					message: 'Your account has been suspended. Please contact support.',
					link: { route: '/settings' },
					surface: 'panel',
					dedupKey: `user:${userId}:status:${nextUserStatus}:${isoDay()}`,
				})
			} else if (name === 'active' && statusName(userStatuses, userStatusRef.current, 'user_status_id') !== 'active') {
				notify({
					type: 'success',
					category: CATEGORIES.ACCOUNT_REACTIVATED,
					message: 'Your account has been reactivated. Welcome back.',
					link: { route: '/dashboard' },
					surface: 'panel',
					dedupKey: `user:${userId}:status:${nextUserStatus}:${isoDay()}`,
				})
			}
		}
		userStatusRef.current = nextUserStatus

		// --- Card status diff ---
		const prevCardMap = cardSnapshotRef.current ?? new Map()
		const selfActionAt = selfActionRef?.current ?? 0
		const withinSelfWindow = Date.now() - selfActionAt < SELF_ACTION_WINDOW_MS

		for (const card of cards) {
			const prev = prevCardMap.get(card.card_id)
			if (prev === undefined || prev === card.status_id) continue
			if (withinSelfWindow) continue // user just changed something themselves

			const name = statusName(cardStatuses, card.status_id, 'card_status_id')
			const prevName = statusName(cardStatuses, prev, 'card_status_id')

			if (name === 'frozen') {
				notify({
					type: 'warning',
					category: CATEGORIES.CARD_BLOCKED,
					message: `Your ${cardLabel(card)} has been blocked by support.`,
					link: { route: '/wallet', modal: { kind: 'card', id: card.card_id } },
					surface: 'panel',
					dedupKey: `card:${card.card_id}:status:${card.status_id}:${isoDay()}`,
				})
			} else if (name === 'active' && prevName === 'frozen') {
				notify({
					type: 'success',
					category: CATEGORIES.CARD_UNBLOCKED,
					message: `Your ${cardLabel(card)} has been unblocked.`,
					link: { route: '/wallet', modal: { kind: 'card', id: card.card_id } },
					surface: 'panel',
					dedupKey: `card:${card.card_id}:status:${card.status_id}:${isoDay()}`,
				})
			} else if (name === 'expired') {
				notify({
					type: 'error',
					category: CATEGORIES.CARD_EXPIRED,
					message: `Your ${cardLabel(card)} has expired.`,
					link: { route: '/wallet', modal: { kind: 'card', id: card.card_id } },
					surface: 'panel',
					dedupKey: `card:${card.card_id}:expired:${isoDay().slice(0, 6)}`,
				})
			}
		}
		cardSnapshotRef.current = nextCardMap
	}, [userId, notify, userStatuses, cardStatuses, selfActionRef])

	useVisibilityInterval(tick, POLL_MS, Boolean(userId))
}
