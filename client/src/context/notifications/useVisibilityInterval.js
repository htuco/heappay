import { useEffect, useRef } from 'react'

/**
 * Calls `tick()` every `intervalMs`, but only while the tab is visible.
 * Also calls `tick()` once on mount and on visibilitychange→visible.
 *
 * The hook re-creates the interval whenever `enabled` flips or `intervalMs`
 * changes. `tick` is captured in a ref so changing it doesn't reset the timer.
 */
export function useVisibilityInterval(tick, intervalMs, enabled = true) {
	const tickRef = useRef(tick)

	useEffect(() => {
		tickRef.current = tick
	}, [tick])

	useEffect(() => {
		if (!enabled) return

		let timerId = null

		const run = () => {
			try {
				tickRef.current()
			} catch {
				// listener errors must not break the loop
			}
		}

		const start = () => {
			if (timerId != null) return
			run()
			timerId = setInterval(run, intervalMs)
		}

		const stop = () => {
			if (timerId != null) {
				clearInterval(timerId)
				timerId = null
			}
		}

		const onVisibility = () => {
			if (document.visibilityState === 'visible') start()
			else stop()
		}

		if (document.visibilityState === 'visible') start()
		document.addEventListener('visibilitychange', onVisibility)

		return () => {
			document.removeEventListener('visibilitychange', onVisibility)
			stop()
		}
	}, [enabled, intervalMs])
}
