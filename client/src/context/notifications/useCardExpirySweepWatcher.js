import { useCallback, useEffect, useRef } from 'react'
import { listCards } from '@/services/cardsService'
import { CATEGORIES } from './categories'
import { cardLabel, formatAmount } from './format'
import { useVisibilityInterval } from './useVisibilityInterval'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'

const POLL_MS = 30_000
const SELF_ACTION_WINDOW_MS = 5_000

function daysUntil(dateStr) {
	if (!dateStr) return null
	const exp = new Date(`${dateStr}T23:59:59`)
	if (Number.isNaN(exp.getTime())) return null
	return Math.ceil((exp.getTime() - Date.now()) / 86400000)
}

function snapshotFromCards(cards) {
	const map = new Map()
	for (const card of cards) {
		map.set(card.card_id, {
			expires_at: card.expires_at,
			balance: card.balance,
			masked_card_number: card.masked_card_number,
			is_main: Boolean(card.is_main),
		})
	}
	return map
}

function findMainCardId(cards) {
	const main = cards.find((c) => c.is_main)
	return main?.card_id ?? cards[0]?.card_id ?? null
}

/**
 * Detects cards removed by the server expiry job (soft-deleted after
 * expires_at). Emits separate notifications for removal and balance sweep.
 */
export function useCardExpirySweepWatcher({ userId, notify, selfActionRef }) {
  const { formatMoney } = useDisplayCurrency()
	const snapshotRef = useRef(null)
	const establishedRef = useRef(false)

	useEffect(() => {
		snapshotRef.current = null
		establishedRef.current = false
	}, [userId])

	const tick = useCallback(async () => {
		if (!userId) return

		let rawCards
		try {
			rawCards = await listCards({ user_id: userId })
		} catch {
			return
		}

		const cards = Array.isArray(rawCards) ? rawCards : (rawCards?.data ?? rawCards?.items ?? [])
		const nextSnapshot = snapshotFromCards(cards)
		const mainCardId = findMainCardId(cards)

		if (!establishedRef.current) {
			establishedRef.current = true
			snapshotRef.current = nextSnapshot
			return
		}

		const prevSnapshot = snapshotRef.current ?? new Map()
		const withinSelfWindow =
			Date.now() - (selfActionRef?.current ?? 0) < SELF_ACTION_WINDOW_MS

		for (const [cardId, prev] of prevSnapshot) {
			if (nextSnapshot.has(cardId)) continue
			if (withinSelfWindow) continue

			const days = daysUntil(prev.expires_at)
			const label = cardLabel(prev)
			const wasExpired = days !== null && days < 0

			notify({
				type: wasExpired ? 'error' : 'info',
				category: wasExpired ? CATEGORIES.CARD_EXPIRED : CATEGORIES.CARD_REMOVED,
				message: wasExpired
					? `Your ${label} has expired and been removed from your wallet.`
					: `Your ${label} has been removed from your wallet.`,
				link: { route: '/wallet' },
				surface: 'both',
				dedupKey: wasExpired
					? `card:${cardId}:removed:expired`
					: `card:${cardId}:removed:manual`,
			})

			const swept = Number.parseFloat(prev.balance ?? '0')
			if (swept > 0) {
				notify({
					type: 'success',
					category: CATEGORIES.CARD_BALANCE_SWEPT,
					message: `${formatAmount(swept, formatMoney)} from your ${label} was transferred to your main card.`,
					link: mainCardId
						? { route: '/wallet', modal: { kind: 'card', id: mainCardId } }
						: { route: '/wallet' },
					surface: 'both',
					dedupKey: `card:${cardId}:balance_swept`,
				})
			}
		}

		snapshotRef.current = nextSnapshot
	}, [userId, notify, selfActionRef, formatMoney])

	useVisibilityInterval(tick, POLL_MS, Boolean(userId))
}
