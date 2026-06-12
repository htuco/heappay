import { useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

/**
 * Returns `(item) => void`. Navigates to the route encoded on the
 * notification's `link`, and — if a modal target is present — appends a
 * query parameter so the destination page can open the detail surface.
 *
 * Supported modal kinds:
 *   - { kind: 'transaction', id }  → ?tx=<id>  (PaymentPage opens detail panel)
 *   - { kind: 'card', id }         → ?card=<id> (no detail surface yet; just lands on /wallet)
 *
 * Items without a `link` are silently ignored.
 */
export function useNotificationNavigation() {
	const navigate = useNavigate()
	const location = useLocation()

	return useCallback(
		(item) => {
			const link = item?.link
			if (!link?.route) return

			let target = link.route
			if (link.modal?.kind && link.modal?.id != null) {
				const paramKey = QUERY_KEY_BY_KIND[link.modal.kind]
				if (paramKey) {
					const sep = target.includes('?') ? '&' : '?'
					target = `${target}${sep}${paramKey}=${encodeURIComponent(link.modal.id)}`
				}
			}

			// If we're already on the same pathname+search, re-issuing navigate()
			// is a no-op in react-router. Force the param to land by using
			// `replace: false` so back-button still works, but pass a key.
			const currentFull = `${location.pathname}${location.search}`
			if (currentFull === target) {
				navigate(target, { replace: true })
			} else {
				navigate(target)
			}
		},
		[navigate, location.pathname, location.search],
	)
}

const QUERY_KEY_BY_KIND = {
	transaction: 'tx',
	card: 'card',
}
