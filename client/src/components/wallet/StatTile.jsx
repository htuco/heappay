export default function StatTile({ label, count, percentage, accentClass }) {
	return (
		<div className="group relative overflow-hidden rounded-2xl bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
			<span className={`absolute inset-x-0 top-0 h-1 ${accentClass}`} aria-hidden="true" />
			<div className="flex items-baseline justify-between gap-3">
				<p className="text-sm font-medium text-muted-foreground">{label}</p>
				<span className="tabular text-xs text-muted-foreground">{percentage}%</span>
			</div>
			<p className="tabular mt-2 text-3xl font-bold tracking-tight text-card-foreground">
				{count}
			</p>
		</div>
	)
}
