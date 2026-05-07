import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useNotifications } from '@/context/NotificationContext'
import { cn } from '@/lib/utils'

const STYLES = {
	success: {
		container: 'border-green-500/40 bg-green-950/80 text-green-200',
		icon: <CheckCircle className="size-4 shrink-0 text-green-400" />,
	},
	error: {
		container: 'border-red-500/40 bg-red-950/80 text-red-200',
		icon: <XCircle className="size-4 shrink-0 text-red-400" />,
	},
	warning: {
		container: 'border-yellow-500/40 bg-yellow-950/80 text-yellow-200',
		icon: <AlertTriangle className="size-4 shrink-0 text-yellow-400" />,
	},
	info: {
		container: 'border-border bg-card text-card-foreground',
		icon: <Info className="size-4 shrink-0 text-muted-foreground" />,
	},
}

function Toast({ notification, onDismiss }) {
	const { container, icon } = STYLES[notification.type] ?? STYLES.info

	return (
		<div
			className={cn(
				'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm',
				'w-80 max-w-[calc(100vw-2.5rem)]',
				container,
			)}
			role="alert"
		>
			{icon}
			<p className="flex-1 leading-snug">{notification.message}</p>
			<button
				type="button"
				onClick={() => onDismiss(notification.id)}
				className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
				aria-label="Dismiss"
			>
				<X className="size-3.5" />
			</button>
		</div>
	)
}

export default function ToastStack() {
	const { queue, dismiss } = useNotifications()
	if (!queue.length) return null

	return (
		<div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end">
			{queue.map((n) => (
				<Toast key={n.id} notification={n} onDismiss={dismiss} />
			))}
		</div>
	)
}
