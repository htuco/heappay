import { useCallback, useEffect } from 'react'
import { listCards } from '@/services/cardsService'
import { subscribeDataChange, DATA_CHANGE_KINDS } from '@/utils/dataEvents'
import { CATEGORIES } from './categories'

const EXPIRING_THRESHOLD_DAYS = 30

function lastFour(maskedNumber) {
	if (!maskedNumber) return '????'
	const digits = String(maskedNumber).replace(/\D/g, '')
	return digits.slice(-4) || '????'
}

function daysUntil(dateStr) {
	if (!dateStr) return null
	const exp = new Date(`${dateStr}T23:59:59`)
	if (Number.isNaN(exp.getTime())) return null
	return Math.ceil((exp.getTime() - Date.now()) / 86400000)
}

function yyyymm(ts = Date.now()) {
	const d = new Date(ts)
	return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Surfaces "card expires in N days" warnings and "card expired" notifications.
 *
 * Runs once on user mount and again whenever cards mutate. Dedup keys carry
 * year-month so the same warning fires at most once per calendar month
 * per card.
 */
export function useCardExpiryWatcher({ userId, notify }) {
	const check = useCallback(async () => {
		if (!userId) return

		let rawCards
		try {
			rawCards = await listCards({ user_id: userId })
		} catch {
			return
		}

		const cards = Array.isArray(rawCards) ? rawCards : (rawCards?.data ?? rawCards?.items ?? [])
		const month = yyyymm()

		for (const card of cards) {
			const days = daysUntil(card.expires_at)
			if (days === null) continue
			const label = `card ****${lastFour(card.masked_card_number)}`

			if (days < 0) {
				notify({
					type: 'error',
					category: CATEGORIES.CARD_EXPIRED,
					message: `Your ${label} has expired.`,
					link: { route: '/wallet', modal: { kind: 'card', id: card.card_id } },
					surface: 'panel',
					dedupKey: `card:${card.card_id}:expired:${month}`,
				})
			} else if (days <= EXPIRING_THRESHOLD_DAYS) {
				const phrase = days === 0
					? 'expires today'
					: days === 1
						? 'expires tomorrow'
						: `expires in ${days} days`
				notify({
					type: 'warning',
					category: CATEGORIES.CARD_EXPIRING,
					message: `Your ${label} ${phrase}.`,
					link: { route: '/wallet', modal: { kind: 'card', id: card.card_id } },
					surface: 'panel',
					dedupKey: `card:${card.card_id}:expiring:${month}`,
				})
			}
		}
	}, [userId, notify])

	useEffect(() => {
		if (!userId) return
		check()
		const unsubscribe = subscribeDataChange((kind) => {
			if (kind === DATA_CHANGE_KINDS.CARD) check()
		})
		return unsubscribe
	}, [userId, check])
}
