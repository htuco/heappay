import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useNotifications } from '@/context/NotificationContext'
import { cn } from '@/lib/utils'
import { getNotificationMeta, getAccentClasses } from '@/components/notifications/notificationMeta'

const EXIT_MS = 200

const STYLES = {
	success: 'border-success/40 bg-success/15 text-success-foreground',
	error: 'border-destructive/40 bg-destructive/15 text-destructive-foreground',
	warning: 'border-warning/40 bg-warning/15 text-warning-foreground',
	info: 'border-border bg-card text-card-foreground',
}

function Toast({ notification, onDismiss }) {
	const [leaving, setLeaving] = useState(false)
	const exitTimer = useRef(null)
	const autoTimer = useRef(null)
	const remainingRef = useRef(notification.duration ?? 0)
	const startedAtRef = useRef(0)
	const { Icon, accent } = getNotificationMeta(notification)
	const accentClasses = getAccentClasses(accent)
	const container = STYLES[notification.type] ?? STYLES.info

	const beginExit = () => {
		if (leaving) return
		setLeaving(true)
		exitTimer.current = setTimeout(() => onDismiss(notification.id), EXIT_MS)
	}

	const startAutoDismiss = () => {
		if (remainingRef.current <= 0) return
		startedAtRef.current = Date.now()
		autoTimer.current = setTimeout(beginExit, remainingRef.current)
	}

	const pauseAutoDismiss = () => {
		if (!autoTimer.current) return
		clearTimeout(autoTimer.current)
		autoTimer.current = null
		const elapsed = Date.now() - startedAtRef.current
		remainingRef.current = Math.max(0, remainingRef.current - elapsed)
	}

	// Schedule the auto-dismiss locally so we can play the exit animation
	// before the item leaves the queue.
	useEffect(() => {
		startAutoDismiss()
		return () => {
			clearTimeout(autoTimer.current)
			clearTimeout(exitTimer.current)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [notification.id])

	return (
		<div
			className={cn(
				'flex items-start gap-3 rounded-surface border px-4 py-3 text-sm backdrop-blur-sm',
				'w-80 max-w-[calc(100vw-2.5rem)]',
				container,
				leaving
					? 'animate-out fade-out-0 slide-out-to-right-6 duration-200 ease-in'
					: 'animate-in fade-in-0 slide-in-from-right-6 duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)]',
			)}
			// Errors interrupt (assertive/alert); everything else is announced
			// politely via the container's live region without stealing focus.
			role={notification.type === 'error' ? 'alert' : 'status'}
			onMouseEnter={pauseAutoDismiss}
			onMouseLeave={startAutoDismiss}
		>
			<div
				className={cn(
					'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-background/40',
					accentClasses.text,
				)}
			>
				<Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
			</div>
			<p className="flex-1 leading-snug text-foreground">{notification.message}</p>
			<button
				type="button"
				onClick={beginExit}
				className="shrink-0 rounded-pill p-0.5 text-muted-foreground opacity-60 hover:opacity-100 hover:bg-muted/60 transition-opacity"
				aria-label="Dismiss"
			>
				<X className="size-3.5" />
			</button>
		</div>
	)
}

export default function ToastStack() {
	const { queue, dismiss } = useNotifications()

	// The live region is always mounted (even when empty) so screen readers
	// register it up front and announce toasts as they're added. Mounting it
	// only when toasts exist can cause the first announcement to be missed.
	return (
		<div
			className="fixed bottom-5 right-5 z-60 flex flex-col gap-2 items-end"
			role="region"
			aria-label="Notifications"
			aria-live="polite"
			aria-relevant="additions"
		>
			{queue.map((n) => (
				<Toast key={n.id} notification={n} onDismiss={dismiss} />
			))}
		</div>
	)
}
