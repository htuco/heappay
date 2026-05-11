import StatTile from './StatTile'
import {
	cardStatusOverviewStatuses,
} from '@/utils/cardStatusOverview'

const ACCENT_CLASS = {
	active: 'bg-success',
	disabled: 'bg-destructive',
	inactive: 'bg-muted-foreground/40',
}

export default function CardStatsRow({
	totalCards = 0,
	statuses = cardStatusOverviewStatuses,
	statusCounts = {},
}) {
	const safeTotal = Math.max(totalCards, 1)
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{statuses.map((status) => {
				const count = statusCounts[status.id] ?? 0
				return (
					<StatTile
						key={status.id}
						label={status.label}
						count={count}
						percentage={Math.round((count / safeTotal) * 100)}
						accentClass={ACCENT_CLASS[status.id] ?? 'bg-muted-foreground/40'}
					/>
				)
			})}
		</div>
	)
}
