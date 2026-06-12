import { BellOff } from 'lucide-react'

export default function NotificationEmptyState() {
	return (
		<div className="flex flex-col items-center justify-center px-6 py-10 text-center">
			<div className="flex h-12 w-12 items-center justify-center rounded-pill bg-muted/60 text-muted-foreground mb-3">
				<BellOff className="h-5 w-5" strokeWidth={1.75} />
			</div>
			<p className="text-sm font-medium text-foreground">You&rsquo;re all caught up</p>
			<p className="mt-1 text-xs text-muted-foreground">
				New activity will show up here.
			</p>
		</div>
	)
}
