// Per-user persistence for the guided product tour, mirroring the shape used by
// the notifications store (see context/notifications/storage.js): a
// `heap.tour.<userId>` namespace, a guarded read, and silent tolerance of a
// blocked or cleared store. The flag is a convenience (so a returning user
// isn't re-prompted), not a correctness requirement — the tour is only ever
// started explicitly from the "Take a tour" button, never auto-started.
const ROOT_KEY = 'heap.tour'

function keyFor(userId, suffix) {
	return `${ROOT_KEY}.${userId}${suffix ? `.${suffix}` : ''}`
}

export function loadTourCompleted(userId) {
	if (!userId) return false
	try {
		return localStorage.getItem(keyFor(userId, 'completed')) === 'true'
	} catch {
		// Blocked or unavailable store — treat as "not completed".
		return false
	}
}

export function saveTourCompleted(userId, completed) {
	if (!userId) return
	try {
		localStorage.setItem(keyFor(userId, 'completed'), String(Boolean(completed)))
	} catch {
		// Quota exceeded or storage unavailable — the choice just doesn't persist.
	}
}
