/**
 * Read the user's motion preference. There was no shared helper — CardCarousel
 * and the guided tour both need the same query, so it lives here.
 */
export function getPrefersReducedMotion() {
	if (typeof window === 'undefined') return false
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
