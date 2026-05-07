import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useNotifications } from '@/context/NotificationContext'
import { cn } from '@/lib/utils'

const TYPE_ICON = {
	success: <CheckCircle className="size-3.5 text-green-400 shrink-0 mt-0.5" />,
	error:   <XCircle    className="size-3.5 text-red-400 shrink-0 mt-0.5" />,
	warning: <AlertTriangle className="size-3.5 text-yellow-400 shrink-0 mt-0.5" />,
	info:    <Info       className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />,
}

function timeAgo(ts) {
	const s = Math.floor((Date.now() - ts) / 1000)
	if (s < 60) return 'just now'
	if (s < 3600) return `${Math.floor(s / 60)}m ago`
	return `${Math.floor(s / 3600)}h ago`
}

export default function NotificationPanel() {
	const { history, clearHistory } = useNotifications()
	const [open, setOpen] = useState(false)
	const [seen, setSeen] = useState(0)
	const panelRef = useRef(null)

	const unseen = history.length - seen

	const handleOpen = () => {
		setOpen((prev) => !prev)
		setSeen(history.length)
	}

	// Close on outside click
	useEffect(() => {
		if (!open) return
		const handler = (e) => {
			if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [open])

	return (
		<div className="relative" ref={panelRef}>
			<button
				type="button"
				onClick={handleOpen}
				className="nav-pill relative p-2 rounded-xl text-muted-foreground hover:bg-muted/60 hover:text-foreground"
				aria-label="Notifications"
			>
				<Bell className="h-[18px] w-[18px]" strokeWidth={2} />
				{unseen > 0 && (
					<span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-card" />
				)}
			</button>

			{open && (
				<div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-popover shadow-lg z-50 overflow-hidden">
					<div className="flex items-center justify-between px-4 py-3 border-b border-border">
						<p className="text-sm font-semibold text-foreground">Notifications</p>
						{history.length > 0 && (
							<button
								type="button"
								onClick={clearHistory}
								className="text-xs text-muted-foreground hover:text-foreground transition-colors"
							>
								Clear all
							</button>
						)}
					</div>

					<div className="max-h-80 overflow-y-auto">
						{history.length === 0 ? (
							<p className="px-4 py-6 text-center text-sm text-muted-foreground">
								No notifications yet.
							</p>
						) : (
							<ul>
								{history.map((n) => (
									<li
										key={n.id}
										className="flex gap-2.5 px-4 py-3 border-b border-border/50 last:border-0"
									>
										{TYPE_ICON[n.type] ?? TYPE_ICON.info}
										<div className="flex-1 min-w-0">
											<p className="text-sm text-foreground leading-snug">{n.message}</p>
											<p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</p>
										</div>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			)}
		</div>
	)
}
