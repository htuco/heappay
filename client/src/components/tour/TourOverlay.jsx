import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Padding around the highlighted element (the "hole" in the scrim) and the gap
// between that hole and the popover.
const SPOTLIGHT_PAD = 8
const POPOVER_GAP = 14
const EDGE_MARGIN = 16
// Below this width the popover docks above the mobile tab bar instead of
// sitting next to the element — a desktop-anchored popover mispositions on a
// phone (the ticket's §5). The element is still spotlit and scrolled into view.
const MOBILE_MAX = 640
const POPOVER_WIDTH = 340

function clamp(value, min, max) {
	if (max < min) return min
	return Math.min(Math.max(value, min), max)
}

// Where to place the popover in viewport coordinates. Prefers the step's
// placement, flips it when it would overflow, then clamps so the card never
// leaves the viewport (no horizontal scroll at any width).
function computePosition({ rect, placement, size, vw, vh }) {
	const { w, h } = size
	if (!rect) {
		return { left: (vw - w) / 2, top: vh - h - EDGE_MARGIN, docked: true }
	}

	const cx = rect.left + rect.width / 2
	const cy = rect.top + rect.height / 2
	const spaceBelow = vh - rect.top - rect.height
	const spaceAbove = rect.top
	const spaceRight = vw - rect.left - rect.width
	const spaceLeft = rect.left

	let place = placement
	if (place === 'bottom' && spaceBelow < h + POPOVER_GAP + EDGE_MARGIN && spaceAbove > spaceBelow) {
		place = 'top'
	} else if (place === 'top' && spaceAbove < h + POPOVER_GAP + EDGE_MARGIN && spaceBelow > spaceAbove) {
		place = 'bottom'
	} else if (place === 'right' && spaceRight < w + POPOVER_GAP + EDGE_MARGIN && spaceLeft > spaceRight) {
		place = 'left'
	} else if (place === 'left' && spaceLeft < w + POPOVER_GAP + EDGE_MARGIN && spaceRight > spaceLeft) {
		place = 'right'
	}

	let left
	let top
	switch (place) {
		case 'top':
			left = cx - w / 2
			top = rect.top - SPOTLIGHT_PAD - POPOVER_GAP - h
			break
		case 'left':
			left = rect.left - SPOTLIGHT_PAD - POPOVER_GAP - w
			top = cy - h / 2
			break
		case 'right':
			left = rect.left + rect.width + SPOTLIGHT_PAD + POPOVER_GAP
			top = cy - h / 2
			break
		case 'bottom':
		default:
			left = cx - w / 2
			top = rect.top + rect.height + SPOTLIGHT_PAD + POPOVER_GAP
			break
	}

	return {
		left: clamp(left, EDGE_MARGIN, vw - w - EDGE_MARGIN),
		top: clamp(top, EDGE_MARGIN, vh - h - EDGE_MARGIN),
		docked: false,
	}
}

// Four scrim panels around the spotlight hole (rather than one panel with a
// CSS mask), so the highlighted element sits in a genuine gap and stays
// clickable when a step asks the user to interact with it, while the rest of
// the page is covered and click-blocked.
function Scrim({ rect }) {
	const scrimColor = 'rgb(2 6 23 / 0.55)'
	if (!rect) {
		return (
			<div
				className="fixed inset-0"
				style={{ backgroundColor: scrimColor, pointerEvents: 'auto' }}
			/>
		)
	}

	const top = Math.max(rect.top - SPOTLIGHT_PAD, 0)
	const left = Math.max(rect.left - SPOTLIGHT_PAD, 0)
	const right = rect.left + rect.width + SPOTLIGHT_PAD
	const bottom = rect.top + rect.height + SPOTLIGHT_PAD
	const panel = { position: 'fixed', backgroundColor: scrimColor, pointerEvents: 'auto' }

	return (
		<>
			<div style={{ ...panel, top: 0, left: 0, right: 0, height: top }} />
			<div style={{ ...panel, top: bottom, left: 0, right: 0, bottom: 0 }} />
			<div style={{ ...panel, top, left: 0, width: left, height: bottom - top }} />
			<div style={{ ...panel, top, left: right, right: 0, height: bottom - top }} />
			{/* Highlight ring — non-interactive so it never intercepts a click meant
			    for the element it frames. */}
			<div
				className="pointer-events-none fixed rounded-lg"
				style={{
					top,
					left,
					width: right - left,
					height: bottom - top,
					boxShadow: '0 0 0 2px var(--primary), 0 0 0 6px rgb(37 99 235 / 0.25)',
				}}
			/>
		</>
	)
}

export default function TourOverlay({
	step,
	stepIndex,
	stepCount,
	rect,
	reduceMotion,
	onNext,
	onBack,
	onSkip,
	isFirst,
	isLast,
}) {
	const popoverRef = useRef(null)
	const [size, setSize] = useState({ w: POPOVER_WIDTH, h: 200 })
	const [viewport, setViewport] = useState(() => ({
		vw: typeof window === 'undefined' ? 1280 : window.innerWidth,
		vh: typeof window === 'undefined' ? 800 : window.innerHeight,
	}))

	useEffect(() => {
		const onResize = () =>
			setViewport({ vw: window.innerWidth, vh: window.innerHeight })
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	}, [])

	// Measure the popover once its content is in place so positioning uses the
	// real size rather than the estimate.
	useLayoutEffect(() => {
		const node = popoverRef.current
		if (!node) return
		const r = node.getBoundingClientRect()
		setSize((prev) =>
			prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height },
		)
	}, [step.id, viewport.vw])

	const isMobile = viewport.vw < MOBILE_MAX
	const pos = computePosition({
		rect: isMobile ? null : rect,
		placement: step.placement,
		size,
		vw: viewport.vw,
		vh: viewport.vh,
	})

	// Focus management: move focus into the popover, trap Tab within it, and let
	// Esc leave the tour. Refocusing the primary control on each step change also
	// nudges screen-reader focus to the fresh step.
	useEffect(() => {
		const node = popoverRef.current
		if (!node) return
		const autofocus = node.querySelector('[data-tour-autofocus]')
		if (autofocus) autofocus.focus()

		function onKeyDown(event) {
			if (event.key === 'Escape') {
				event.preventDefault()
				onSkip()
				return
			}
			if (event.key !== 'Tab') return
			const focusables = node.querySelectorAll(
				'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
			)
			if (focusables.length === 0) return
			const first = focusables[0]
			const last = focusables[focusables.length - 1]
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault()
				last.focus()
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault()
				first.focus()
			}
		}

		document.addEventListener('keydown', onKeyDown)
		return () => document.removeEventListener('keydown', onKeyDown)
	}, [onSkip, step.id])

	const titleId = 'tour-step-title'
	const bodyId = 'tour-step-body'

	const overlay = (
		<div className="pointer-events-none fixed inset-0 z-[1000]" role="presentation">
			<Scrim rect={rect} />

			{/* Live region for assistive tech — announces each step as it opens. */}
			<p className="sr-only" aria-live="polite">
				{`Step ${stepIndex + 1} of ${stepCount}: ${step.title}`}
			</p>

			<div
				ref={popoverRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={bodyId}
				className={cn(
					'pointer-events-auto fixed z-[1001] w-[min(340px,calc(100vw-2rem))] rounded-panel border border-border bg-card p-5 text-card-foreground shadow-xl',
					!reduceMotion && 'transition-[top,left,bottom] duration-200 ease-out',
				)}
				style={
					isMobile
						? {
								left: EDGE_MARGIN,
								right: EDGE_MARGIN,
								width: 'auto',
								bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
								top: 'auto',
							}
						: { top: pos.top, left: pos.left }
				}
			>
				<div className="mb-3 flex items-center justify-between gap-3">
					<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Step {stepIndex + 1} of {stepCount}
					</span>
					<button
						type="button"
						onClick={onSkip}
						aria-label="End tour"
						className="-mr-1 -mt-1 inline-flex size-7 items-center justify-center rounded-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<X className="size-4" aria-hidden />
					</button>
				</div>

				<h2 id={titleId} className="text-base font-semibold text-card-foreground">
					{step.title}
				</h2>
				<p id={bodyId} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
					{step.body}
				</p>

				<div className="mt-5 flex items-center justify-between gap-3">
					<button
						type="button"
						onClick={onSkip}
						className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
					>
						Skip
					</button>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onBack}
							disabled={isFirst}
						>
							<ChevronLeft className="size-4" aria-hidden />
							Back
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={onNext}
							data-tour-autofocus
						>
							{isLast ? 'Finish' : 'Next'}
							{!isLast && <ChevronRight className="size-4" aria-hidden />}
						</Button>
					</div>
				</div>
			</div>
		</div>
	)

	return createPortal(overlay, document.body)
}
