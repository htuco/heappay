const HISTORY_CAP = 50
const ROOT_KEY = 'heap.notifications'

function keyFor(userId, suffix) {
	return `${ROOT_KEY}.${userId}${suffix ? `.${suffix}` : ''}`
}

function safeParse(raw, fallback) {
	if (!raw) return fallback
	try {
		const value = JSON.parse(raw)
		return value ?? fallback
	} catch {
		return fallback
	}
}

export function loadHistory(userId) {
	if (!userId) return []
	const raw = localStorage.getItem(keyFor(userId, 'history'))
	const list = safeParse(raw, [])
	if (!Array.isArray(list)) return []
	// Migrate legacy histories: ids used to come from a counter that reset to 1
	// each page load, so persisted items can share an id (duplicate React keys
	// break list reconciliation). Re-key any collisions to a unique string while
	// preserving order/content.
	const seen = new Set()
	return list.map((item) => {
		if (item == null) return item
		const id = item.id
		if (id == null || seen.has(id)) {
			const fresh = `n_legacy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
			seen.add(fresh)
			return { ...item, id: fresh }
		}
		seen.add(id)
		return item
	})
}

export function saveHistory(userId, history) {
	if (!userId) return
	const trimmed = history.slice(0, HISTORY_CAP)
	try {
		localStorage.setItem(keyFor(userId, 'history'), JSON.stringify(trimmed))
	} catch {
		// quota exceeded or storage unavailable — fail silently
	}
}

export function loadSeenAt(userId) {
	if (!userId) return 0
	const raw = localStorage.getItem(keyFor(userId, 'seenAt'))
	const value = safeParse(raw, 0)
	return typeof value === 'number' ? value : 0
}

export function saveSeenAt(userId, value) {
	if (!userId) return
	try {
		localStorage.setItem(keyFor(userId, 'seenAt'), JSON.stringify(value))
	} catch {
		// noop
	}
}

export function loadBaseline(userId, kind) {
	if (!userId) return null
	const raw = localStorage.getItem(keyFor(userId, `baseline.${kind}`))
	const value = safeParse(raw, null)
	return typeof value === 'number' ? value : null
}

export function saveBaseline(userId, kind, value) {
	if (!userId) return
	try {
		localStorage.setItem(keyFor(userId, `baseline.${kind}`), JSON.stringify(value))
	} catch {
		// noop
	}
}

export function loadDedupSet(userId) {
	if (!userId) return new Set()
	const raw = localStorage.getItem(keyFor(userId, 'dedup'))
	const list = safeParse(raw, [])
	return new Set(Array.isArray(list) ? list : [])
}

export function saveDedupSet(userId, set) {
	if (!userId) return
	const list = Array.from(set).slice(-200)
	try {
		localStorage.setItem(keyFor(userId, 'dedup'), JSON.stringify(list))
	} catch {
		// noop
	}
}

export const NOTIFICATION_HISTORY_CAP = HISTORY_CAP
