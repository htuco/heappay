import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import {
	TRANSACTION_STATUS_OPTIONS,
	TRANSACTION_TYPE_OPTIONS,
} from '@/components/payment/transactionHistory.utils'
import {
	TX_SEGMENT_OPTIONS,
	TX_SORT_OPTIONS,
} from '@/utils/transactionFilterParams'

export default function AdminTransactionFilters({
	filters,
	onChange,
	onClear,
	hasActiveFilters,
	showSort = true,
	showSegment = true,
	className = '',
}) {
	return (
		<div className={`flex flex-wrap items-center gap-2 ${className}`}>
			<input
				type="date"
				value={filters.from}
				onChange={(e) => onChange({ from: e.target.value })}
				className="h-8 rounded-input border border-border bg-background px-2 text-xs text-foreground"
				aria-label="From date"
			/>
			<input
				type="date"
				value={filters.to}
				onChange={(e) => onChange({ to: e.target.value })}
				className="h-8 rounded-input border border-border bg-background px-2 text-xs text-foreground"
				aria-label="To date"
			/>
			<Select
				value={filters.status}
				onChange={(e) => onChange({ status: e.target.value })}
				options={[{ value: '', label: 'All statuses' }, ...TRANSACTION_STATUS_OPTIONS]}
				className="h-8 w-auto rounded-input border-border bg-background py-0 text-xs shadow-none"
			/>
			<Select
				value={filters.type}
				onChange={(e) => onChange({ type: e.target.value })}
				options={[{ value: '', label: 'All types' }, ...TRANSACTION_TYPE_OPTIONS]}
				className="h-8 w-auto rounded-input border-border bg-background py-0 text-xs shadow-none"
			/>
			{showSegment && (
				<Select
					value={filters.segment}
					onChange={(e) => onChange({ segment: e.target.value })}
					options={TX_SEGMENT_OPTIONS}
					className="h-8 w-auto rounded-input border-border bg-background py-0 text-xs shadow-none"
				/>
			)}
			{showSort && (
				<Select
					value={filters.sort}
					onChange={(e) => onChange({ sort: e.target.value })}
					options={TX_SORT_OPTIONS}
					className="h-8 w-auto rounded-input border-border bg-background py-0 text-xs shadow-none"
				/>
			)}
			{hasActiveFilters && (
				<Button
					type="button"
					variant="ghost"
					className="h-8 rounded-input px-2 text-xs text-muted-foreground"
					onClick={onClear}
				>
					<X className="mr-1 size-3" />
					Clear
				</Button>
			)}
		</div>
	)
}
