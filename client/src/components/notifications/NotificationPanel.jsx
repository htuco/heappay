import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, MoreHorizontal, X } from 'lucide-react'
import { useNotifications } from '@/context/NotificationContext'
import { useNotificationNavigation } from '@/context/notifications/useNotificationNavigation'
import { cn } from '@/lib/utils'
import NotificationRow from './NotificationRow'
import NotificationEmptyState from './NotificationEmptyState'
import { groupByDay } from './timeUtils'

const PANEL_OPEN_CLASSES =
	'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-300 ease-[cubic-bezier(0.34,1.45,0.64,1)]'

const SHEET_OPEN_CLASSES =
	'animate-in fade-in-0 slide-in-from-bottom-8 duration-400 ease-[cubic-bezier(0.34,1.45,0.64,1)]'

export default function NotificationPanel({ variant = 'topbar', collapsed = false }) {
	const { history, unreadCount, dotCount, markRead, markAllRead, markAllSeen, discard, clearHistory } =
		useNotifications()
	const navigateForNotification = useNotificationNavigation()
	const [open, setOpen] = useState(false)
	const [menuOpen, setMenuOpen] = useState(false)
	const panelRef = useRef(null)
	const sheetRef = useRef(null)
	const menuRef = useRef(null)

	const groups = useMemo(() => groupByDay(history), [history])

	const handleToggle = useCallback(() => {
		setOpen((prev) => {
			const next = !prev
			// Opening clears the bell dot but leaves rows unread so the user can
			// still see what's new. Rows flip to read on click / "Mark all as read".
			if (next && dotCount > 0) markAllSeen()
			return next
		})
		setMenuOpen(false)
	}, [dotCount, markAllSeen])

	const handleClose = useCallback(() => {
		setOpen(false)
		setMenuOpen(false)
	}, [])

	// Close on outside click (desktop dropdown)
	useEffect(() => {
		if (!open) return
		const handler = (e) => {
			if (panelRef.current?.contains(e.target)) return
			// The mobile sheet is portaled to <body>, outside panelRef
			if (sheetRef.current?.contains(e.target)) return
			handleClose()
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

	// Keep the dot cleared while the panel stays open: anything that arrives
	// in-view has effectively been seen, so advance the seen marker past it.
	useEffect(() => {
		if (open && dotCount > 0) markAllSeen()
	}, [open, dotCount, markAllSeen])

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
			navigateForNotification(item)
			handleClose()
		},
		[markRead, navigateForNotification, handleClose],
	)

	// These fire on mousedown, not click: the document-level outside-click
	// listeners (panel + menu) also run on mousedown and re-render the panel,
	// which unmounts the menu item before its `click` is dispatched — so an
	// onClick here never runs ("Clear all" appeared to do nothing). Acting on
	// mousedown (the event that demonstrably reaches the button) avoids the race.
	// preventDefault keeps focus/selection stable through the re-render.
	const handleClearAll = (e) => {
		e.preventDefault()
		clearHistory()
		setMenuOpen(false)
		handleClose()
	}

	const handleMarkAllRead = (e) => {
		e.preventDefault()
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
								<div className="absolute right-0 top-full mt-1 w-44 rounded-surface border border-border bg-popover z-10 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
									<button
										type="button"
										onMouseDown={handleMarkAllRead}
										onClick={handleMarkAllRead}
										disabled={unreadCount === 0}
										className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
									>
										Mark all as read
									</button>
									<button
										type="button"
										onMouseDown={handleClearAll}
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
						className="sm:hidden flex h-11 w-11 items-center justify-center rounded-pill text-muted-foreground hover:bg-muted hover:text-foreground transition-colors touch-manipulation"
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
								<div className="sticky top-0 z-1 bg-popover/95 backdrop-blur-[2px] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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

	const isSidebar = variant === 'sidebar'

	return (
		<div className="relative" ref={panelRef}>
			<button
				type="button"
				onClick={handleToggle}
				className={cn(
					'nav-pill relative flex items-center text-muted-foreground touch-manipulation',
					isSidebar
						? // Matches the geometry of a sidebar nav row. `w-full` matters:
							// a <button> is content-width by default, so without it the icon
							// sits left of the NavLink rows instead of sharing their centre.
							'w-full gap-2.75 rounded-input px-2.5 py-2.25 text-sm font-medium hover:bg-muted/50 hover:text-sidebar-foreground'
						: 'h-11 w-11 justify-center rounded-input hover:bg-muted/60 hover:text-foreground md:h-auto md:w-auto md:p-2',
					isSidebar && collapsed && 'justify-center',
				)}
				aria-label="Notifications"
				aria-haspopup="dialog"
				aria-expanded={open}
				title={isSidebar && collapsed ? 'Notifications' : undefined}
			>
				<span className="relative flex shrink-0">
					<Bell
						className={cn(isSidebar ? 'size-4.5 opacity-65' : 'h-4.5 w-4.5')}
						strokeWidth={isSidebar ? 1.8 : 2}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					{/* Collapsed rail: the row is full-width, so the dot hangs off the
					    icon rather than the row's right edge. */}
					{dotCount > 0 && isSidebar && collapsed && (
						<span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-destructive ring-2 ring-sidebar" />
					)}
				</span>
				{isSidebar && !collapsed && (
					<>
						<span className="min-w-0 flex-1 truncate text-left">Notifications</span>
						{unreadCount > 0 && (
							<span className="shrink-0 text-xs font-semibold text-primary">{unreadCount}</span>
						)}
					</>
				)}
				{dotCount > 0 && !isSidebar && (
					<span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
				)}
			</button>

			{/* Desktop dropdown — opens upward out of the sidebar's bottom stack,
			    downward from the page header. */}
			{open && (
				<div
					className={cn(
						'hidden sm:flex absolute w-96 max-w-[calc(100vw-1.5rem)]',
						isSidebar ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2',
						'flex-col rounded-surface border border-border bg-popover z-50 overflow-hidden',
						'max-h-[min(40rem,calc(100vh-4rem))]',
						PANEL_OPEN_CLASSES,
					)}
					role="dialog"
					aria-label="Notifications"
				>
					{body}
				</div>
			)}

			{/* Mobile bottom sheet — portaled to <body> so the header's
			    backdrop-blur doesn't become its fixed-position containing block */}
			{open &&
				createPortal(
					<div className="sm:hidden fixed inset-0 z-50 flex flex-col animate-in fade-in-0 duration-200">
						<div
							className="flex-1 bg-overlay backdrop-blur-xs"
							onClick={handleClose}
							aria-hidden
						/>
						<div
							ref={sheetRef}
							className={cn(
								'flex flex-col rounded-t-panel border-t border-border bg-popover',
								'max-h-[85vh] pb-[env(safe-area-inset-bottom,0px)]',
								SHEET_OPEN_CLASSES,
							)}
							role="dialog"
							aria-modal="true"
							aria-label="Notifications"
						>
							<div className="flex justify-center pt-2 pb-1">
								<span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
							</div>
							{body}
						</div>
					</div>,
					document.body,
				)}
		</div>
	)
}
