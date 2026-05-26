import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, MoreHorizontal, X } from 'lucide-react'
import { useNotifications } from '@/context/NotificationContext'
import { cn } from '@/lib/utils'
import NotificationRow from './NotificationRow'
import NotificationEmptyState from './NotificationEmptyState'
import { groupByDay } from './timeUtils'

const PANEL_OPEN_CLASSES =
	'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)]'

const SHEET_OPEN_CLASSES =
	'animate-in fade-in-0 slide-in-from-bottom-8 duration-400 ease-[cubic-bezier(0.34,1.45,0.64,1)]'

export default function NotificationPanel() {
	const { history, unreadCount, markRead, markAllRead, discard, clearHistory } =
		useNotifications()
	const [open, setOpen] = useState(false)
	const [menuOpen, setMenuOpen] = useState(false)
	const panelRef = useRef(null)
	const menuRef = useRef(null)

	const groups = useMemo(() => groupByDay(history), [history])

	const handleToggle = useCallback(() => {
		setOpen((prev) => {
			const next = !prev
			if (next && unreadCount > 0) markAllRead()
			return next
		})
		setMenuOpen(false)
	}, [unreadCount, markAllRead])

	const handleClose = useCallback(() => {
		setOpen(false)
		setMenuOpen(false)
	}, [])

	// Close on outside click (desktop dropdown)
	useEffect(() => {
		if (!open) return
		const handler = (e) => {
			if (panelRef.current && !panelRef.current.contains(e.target)) {
				handleClose()
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [open, handleClose])

	// Close menu on outside click within panel
	useEffect(() => {
		if (!menuOpen) return
		const handler = (e) => {
			if (menuRef.current && !menuRef.current.contains(e.target)) {
				setMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [menuOpen])

	// Escape closes
	useEffect(() => {
		if (!open) return
		const onKey = (e) => {
			if (e.key === 'Escape') handleClose()
		}
		document.addEventListener('keydown', onKey)
		return () => document.removeEventListener('keydown', onKey)
	}, [open, handleClose])

	// Lock body scroll while the mobile sheet is open
	useEffect(() => {
		if (!open) return
		const prev = document.body.style.overflow
		const isSmall = window.matchMedia('(max-width: 639px)').matches
		if (isSmall) {
			document.body.style.overflow = 'hidden'
		}
		return () => {
			document.body.style.overflow = prev
		}
	}, [open])

	const handleSelect = useCallback(
		(item) => {
			markRead(item.id)
			// Deep-link routing comes online in Part 5 (link.route + detail modal).
			// For now selecting a row just marks it read.
			void item
		},
		[markRead],
	)

	const handleClearAll = () => {
		clearHistory()
		setMenuOpen(false)
		handleClose()
	}

	const handleMarkAllRead = () => {
		markAllRead()
		setMenuOpen(false)
	}

	const body = (
		<div className="flex max-h-full flex-1 flex-col overflow-hidden">
			<div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
				<div className="flex items-center gap-2 min-w-0">
					<p className="text-sm font-semibold text-foreground">Notifications</p>
					{unreadCount > 0 && (
						<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
							{unreadCount}
						</span>
					)}
				</div>
				<div className="flex items-center gap-1">
					{history.length > 0 && (
						<div className="relative" ref={menuRef}>
							<button
								type="button"
								onClick={() => setMenuOpen((p) => !p)}
								className="rounded-pill p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								aria-label="Notification options"
								aria-haspopup="menu"
								aria-expanded={menuOpen}
							>
								<MoreHorizontal className="h-4 w-4" />
							</button>
							{menuOpen && (
								<div className="absolute right-0 top-full mt-1 w-44 rounded-surface border border-border bg-popover shadow-lg z-10 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
									<button
										type="button"
										onClick={handleMarkAllRead}
										disabled={unreadCount === 0}
										className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
									>
										Mark all as read
									</button>
									<button
										type="button"
										onClick={handleClearAll}
										className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-destructive/10"
									>
										Clear all
									</button>
								</div>
							)}
						</div>
					)}
					<button
						type="button"
						onClick={handleClose}
						className="sm:hidden rounded-pill p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
						aria-label="Close notifications"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				{history.length === 0 ? (
					<NotificationEmptyState />
				) : (
					<div>
						{groups.map((group) => (
							<section key={group.label}>
								<div className="sticky top-0 z-[1] bg-popover/95 backdrop-blur-[2px] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
									{group.label}
								</div>
								<ul className="divide-y divide-border/40">
									{group.items.map((item) => (
										<NotificationRow
											key={item.id}
											item={item}
											onSelect={handleSelect}
											onDiscard={discard}
										/>
									))}
								</ul>
							</section>
						))}
					</div>
				)}
			</div>
		</div>
	)

	return (
		<div className="relative" ref={panelRef}>
			<button
				type="button"
				onClick={handleToggle}
				className="nav-pill relative p-2 rounded-input text-muted-foreground hover:bg-muted/60 hover:text-foreground"
				aria-label="Notifications"
				aria-haspopup="menu"
				aria-expanded={open}
			>
				<Bell className="h-4.5 w-4.5" strokeWidth={2} />
				{unreadCount > 0 && (
					<span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
				)}
			</button>

			{/* Desktop dropdown */}
			{open && (
				<div
					className={cn(
						'hidden sm:flex absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-1.5rem)]',
						'flex-col rounded-surface border border-border bg-popover shadow-xl z-50 overflow-hidden',
						'max-h-[min(32rem,calc(100vh-6rem))]',
						PANEL_OPEN_CLASSES,
					)}
					role="menu"
				>
					{body}
				</div>
			)}

			{/* Mobile bottom sheet */}
			{open && (
				<div className="sm:hidden fixed inset-0 z-50 flex flex-col animate-in fade-in-0 duration-200">
					<div
						className="flex-1 bg-foreground/30 backdrop-blur-[2px]"
						onClick={handleClose}
						aria-hidden
					/>
					<div
						className={cn(
							'flex flex-col rounded-t-panel border-t border-border bg-popover shadow-2xl',
							'max-h-[85vh]',
							SHEET_OPEN_CLASSES,
						)}
						role="menu"
					>
						<div className="flex justify-center pt-2 pb-1">
							<span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
						</div>
						{body}
					</div>
				</div>
			)}
		</div>
	)
}
