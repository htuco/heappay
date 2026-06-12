export default function NotificationSkeleton({ rows = 4 }) {
	return (
		<ul className="divide-y divide-border/40">
			{Array.from({ length: rows }).map((_, i) => (
				<li key={i} className="flex gap-3 px-4 py-3">
					<div className="h-7 w-7 shrink-0 animate-pulse rounded-pill bg-muted/60" />
					<div className="flex-1 space-y-2 pt-0.5">
						<div className="h-3 w-4/5 animate-pulse rounded-input bg-muted/60" />
						<div className="h-2.5 w-1/3 animate-pulse rounded-input bg-muted/40" />
					</div>
				</li>
			))}
		</ul>
	)
}
