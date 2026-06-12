/**
 * Compact "x ago" used inside a notification row.
 */
export function timeAgo(ts) {
	const s = Math.floor((Date.now() - ts) / 1000)
	if (s < 5) return 'just now'
	if (s < 60) return `${s}s ago`
	if (s < 3600) return `${Math.floor(s / 60)}m ago`
	if (s < 86400) return `${Math.floor(s / 3600)}h ago`
	if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
	return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function startOfDay(ts) {
	const d = new Date(ts)
	d.setHours(0, 0, 0, 0)
	return d.getTime()
}

/**
 * Human-readable day label used as a section header.
 *   today        → "Today"
 *   yesterday    → "Yesterday"
 *   within week  → weekday ("Wednesday")
 *   older        → "Apr 14" / "Apr 14, 2025" if not this year
 */
export function dayLabel(ts) {
	const now = Date.now()
	const todayStart = startOfDay(now)
	const itemStart = startOfDay(ts)
	const diffDays = Math.round((todayStart - itemStart) / 86400000)

	if (diffDays === 0) return 'Today'
	if (diffDays === 1) return 'Yesterday'

	const d = new Date(ts)
	if (diffDays < 7) {
		return d.toLocaleDateString(undefined, { weekday: 'long' })
	}

	const sameYear = new Date(now).getFullYear() === d.getFullYear()
	return d.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		year: sameYear ? undefined : 'numeric',
	})
}

/**
 * Groups history into [{ label, items }] preserving newest-first order.
 */
export function groupByDay(history) {
	const groups = []
	let current = null

	for (const item of history) {
		const label = dayLabel(item.createdAt)
		if (!current || current.label !== label) {
			current = { label, items: [] }
			groups.push(current)
		}
		current.items.push(item)
	}

	return groups
}
