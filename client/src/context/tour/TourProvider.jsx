import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import TourOverlay from '@/components/tour/TourOverlay'
import { TourContext } from './tour-context'
import { TOUR_STEPS, TOUR_STEP_COUNT } from './tourSteps'
import { loadTourCompleted, saveTourCompleted } from './storage'
import { getPrefersReducedMotion } from '@/utils/prefersReducedMotion'

// How long to wait for a step's anchor to mount after navigating before giving
// up and skipping the step. Covers a route transition plus data fetches.
const ANCHOR_TIMEOUT_MS = 3000

/**
 * Owns all guided-tour state. Mounted once in Layout, above the router outlet,
 * so it survives the route changes the tour makes as it walks across pages.
 * The engine navigates to each step's route, waits for its `data-tour` anchor
 * to mount (skipping the step if it never does — e.g. the wallet carousel for a
 * user with no cards), scrolls it into view, and tracks its box so the
 * spotlight follows scroll and layout changes.
 */
export default function TourProvider({ children }) {
	const navigate = useNavigate()
	const location = useLocation()
	const { user } = useAuth()
	const userId = user?.id ?? null

	const [isActive, setIsActive] = useState(false)
	const [stepIndex, setStepIndex] = useState(0)
	const [targetEl, setTargetEl] = useState(null)
	const [targetRect, setTargetRect] = useState(null)
	const [hasCompleted, setHasCompleted] = useState(false)
	const [reduceMotion, setReduceMotion] = useState(getPrefersReducedMotion)

	// 1 when moving forward, -1 when going back — so a skipped (missing) step
	// continues in the direction the user was travelling.
	const directionRef = useRef(1)
	// The route we asked the router to go to, so the "manual navigation ends the
	// tour" guard doesn't mistake our own navigation for the user's.
	const navigatingRef = useRef(null)
	// The element focused before the tour opened, restored when it closes.
	const restoreFocusRef = useRef(null)

	useEffect(() => {
		setHasCompleted(loadTourCompleted(userId))
	}, [userId])

	useEffect(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
		const onChange = () => setReduceMotion(mq.matches)
		mq.addEventListener('change', onChange)
		return () => mq.removeEventListener('change', onChange)
	}, [])

	const endTour = useCallback(
		(markCompleted) => {
			setIsActive(false)
			setTargetEl(null)
			setTargetRect(null)
			navigatingRef.current = null
			if (markCompleted && userId) {
				saveTourCompleted(userId, true)
				setHasCompleted(true)
			}
			const toRestore = restoreFocusRef.current
			restoreFocusRef.current = null
			if (toRestore && typeof toRestore.focus === 'function') {
				// Defer so the overlay unmounts before focus returns to the trigger.
				requestAnimationFrame(() => {
					try {
						toRestore.focus()
					} catch {
						// The trigger may have unmounted — nothing to restore to.
					}
				})
			}
		},
		[userId],
	)

	const finishTour = useCallback(() => endTour(true), [endTour])

	const startTour = useCallback(() => {
		if (isActive) return
		restoreFocusRef.current =
			typeof document !== 'undefined' ? document.activeElement : null
		directionRef.current = 1
		setTargetEl(null)
		setTargetRect(null)
		setStepIndex(0)
		setIsActive(true)
	}, [isActive])

	const goNext = useCallback(() => {
		directionRef.current = 1
		if (stepIndex + 1 >= TOUR_STEP_COUNT) {
			finishTour()
			return
		}
		setTargetEl(null)
		setStepIndex((current) => current + 1)
	}, [finishTour, stepIndex])

	const goBack = useCallback(() => {
		directionRef.current = -1
		setTargetEl(null)
		setStepIndex((current) => (current <= 0 ? current : current - 1))
	}, [])

	// Resolve the current step: navigate to its route if needed, then poll for
	// its anchor. On success, scroll it into view and hand the node to the
	// tracking effect. On timeout, warn in dev and skip in the current direction.
	useEffect(() => {
		if (!isActive) return
		const step = TOUR_STEPS[stepIndex]
		if (!step) return

		if (step.route && location.pathname !== step.route) {
			navigatingRef.current = step.route
			navigate(step.route)
			return
		}
		navigatingRef.current = null

		let cancelled = false
		let raf = 0
		const startedAt = performance.now()

		const skipMissing = () => {
			const direction = directionRef.current
			const nextIndex = stepIndex + direction
			if (nextIndex >= TOUR_STEP_COUNT) {
				finishTour()
			} else if (nextIndex < 0) {
				endTour(false)
			} else {
				setTargetEl(null)
				setStepIndex(nextIndex)
			}
		}

		const resolve = () => {
			if (cancelled) return
			const el = document.querySelector(`[data-tour="${step.anchor}"]`)
			if (el) {
				setTargetEl(el)
				try {
					el.scrollIntoView({
						block: 'center',
						inline: 'nearest',
						behavior: reduceMotion ? 'auto' : 'smooth',
					})
				} catch {
					// Non-standard scrollIntoView options — the plain call is enough.
					el.scrollIntoView()
				}
				return
			}
			if (performance.now() - startedAt > ANCHOR_TIMEOUT_MS) {
				if (import.meta.env?.DEV) {
					console.warn(
						`[tour] anchor [data-tour="${step.anchor}"] for step "${step.id}" never mounted — skipping.`,
					)
				}
				skipMissing()
				return
			}
			raf = requestAnimationFrame(resolve)
		}

		raf = requestAnimationFrame(resolve)
		return () => {
			cancelled = true
			if (raf) cancelAnimationFrame(raf)
		}
	}, [isActive, stepIndex, location.pathname, navigate, reduceMotion, finishTour, endTour])

	// If the user navigates away from the current step's route by their own
	// action (not our step navigation), leave the tour rather than fight them.
	useEffect(() => {
		if (!isActive) return
		const step = TOUR_STEPS[stepIndex]
		if (!step?.route) return
		if (location.pathname === step.route) {
			navigatingRef.current = null
			return
		}
		if (navigatingRef.current === step.route) return
		endTour(false)
	}, [location.pathname, isActive, stepIndex, endTour])

	// Keep the spotlight aligned with the element while the tour is open — this
	// runs the box through smooth-scroll settling, resizes, and layout shifts.
	useEffect(() => {
		if (!isActive || !targetEl) return
		let raf = 0
		const update = () => {
			const r = targetEl.getBoundingClientRect()
			setTargetRect((prev) => {
				if (
					prev &&
					prev.top === r.top &&
					prev.left === r.left &&
					prev.width === r.width &&
					prev.height === r.height
				) {
					return prev
				}
				return { top: r.top, left: r.left, width: r.width, height: r.height }
			})
			raf = requestAnimationFrame(update)
		}
		raf = requestAnimationFrame(update)
		return () => cancelAnimationFrame(raf)
	}, [isActive, targetEl])

	const contextValue = {
		isActive,
		stepIndex,
		hasCompleted,
		startTour,
		endTour: () => endTour(false),
	}

	const step = isActive ? TOUR_STEPS[stepIndex] : null

	return (
		<TourContext.Provider value={contextValue}>
			{children}
			{step && (
				<TourOverlay
					step={step}
					stepIndex={stepIndex}
					stepCount={TOUR_STEP_COUNT}
					rect={targetRect}
					reduceMotion={reduceMotion}
					onNext={goNext}
					onBack={goBack}
					onSkip={() => endTour(false)}
					isFirst={stepIndex === 0}
					isLast={stepIndex === TOUR_STEP_COUNT - 1}
				/>
			)}
		</TourContext.Provider>
	)
}
