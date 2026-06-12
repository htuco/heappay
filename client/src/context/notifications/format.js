/**
 * Shared formatting helpers for notification watchers and messages.
 * Kept together so the four watchers don't each carry their own copy.
 */

/**
 * Extracts the last four digits from a masked card number string.
 * Returns '????' when the input is missing or has no digits.
 */
export function lastFour(maskedNumber) {
	if (!maskedNumber) return '????'
	const digits = String(maskedNumber).replace(/\D/g, '')
	return digits.slice(-4) || '????'
}

/**
 * `card ****1234` label used across card-related notifications.
 */
export function cardLabel(card) {
	return `card ****${lastFour(card?.masked_card_number)}`
}

/**
 * Formats an amount (number or numeric string) as USD currency.
 * Falls back to the raw string when it isn't a finite number.
 */
export function formatAmount(amount) {
	if (amount == null) return ''
	const n = Number.parseFloat(amount)
	if (Number.isNaN(n)) return String(amount)
	return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
