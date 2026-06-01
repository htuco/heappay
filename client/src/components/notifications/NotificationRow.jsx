import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getNotificationMeta, getAccentClasses } from './notificationMeta'
import { timeAgo } from './timeUtils'

const EXIT_MS = 200

export default function NotificationRow({ item, onSelect, onDiscard }) {
	const [leaving, setLeaving] = useState(false)
	const { Icon, accent } = getNotificationMeta(item)
	const accentClasses = getAccentClasses(accent)
	const unread = !item.read

	const handleDiscard = (e) => {
		e.stopPropagation()
		if (leaving) return
		setLeaving(true)
		setTimeout(() => onDiscard(item.id), EXIT_MS)
	}

	const handleSelect = () => {
		if (leaving) return
		onSelect(item)
	}

	return (
		<li
			className={cn(
				'group relative flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors',
				'hover:bg-muted/40',
				unread && accentClasses.tintBg,
				leaving
					? 'animate-out fade-out-0 slide-out-to-right-4 duration-200 ease-in'
					: 'animate-in fade-in-0 slide-in-from-top-1 duration-200',
			)}
			onClick={handleSelect}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault()
					handleSelect()
				}
			}}
		>
			{/* Left accent rule (unread only) */}
			{unread && (
				<span
					aria-hidden
					className={cn(
						'absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full',
						accentClasses.rule,
					)}
				/>
			)}

			<div
				className={cn(
					'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-pill',
					'bg-muted/50',
					accentClasses.text,
				)}
			>
				<Icon className="h-3.5 w-3.5" strokeWidth={2} />
			</div>

			<div className="min-w-0 flex-1">
				<p
					className={cn(
						'text-sm leading-snug text-foreground',
						unread ? 'font-medium' : 'font-normal',
					)}
				>
					{item.message}
				</p>
				<p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(item.createdAt)}</p>
			</div>

			<button
				type="button"
				onClick={handleDiscard}
				className={cn(
					'shrink-0 self-start rounded-pill p-1 text-muted-foreground/60',
					'opacity-0 transition-all hover:bg-muted hover:text-foreground',
					'group-hover:opacity-100 focus-visible:opacity-100',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
				)}
				aria-label="Discard notification"
			>
				<X className="h-3.5 w-3.5" />
			</button>
		</li>
	)
}
