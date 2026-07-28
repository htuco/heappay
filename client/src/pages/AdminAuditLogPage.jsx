import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import auditLogService from '@/services/auditLogService'

const PAGE_SIZE = 20

function formatDate(iso) {
	if (!iso) return '—'
	return new Date(iso).toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	})
}

function actorLabel(event) {
	if (event.actor_name) return event.actor_name
	if (event.actor_email) return event.actor_email
	if (event.actor_user_id) return `User #${event.actor_user_id}`
	return '—'
}

function targetLabel(event) {
	if (event.target_name) return event.target_name
	if (event.target_email) return event.target_email
	if (event.target_user_id) return `User #${event.target_user_id}`
	return '—'
}

export default function AdminAuditLogPage() {
	const [items, setItems] = useState([])
	const [total, setTotal] = useState(0)
	const [page, setPage] = useState(1)
	const [eventTypes, setEventTypes] = useState([])
	const [eventType, setEventType] = useState('')
	const [fromDate, setFromDate] = useState('')
	const [toDate, setToDate] = useState('')
	const [search, setSearch] = useState('')
	const [isLoading, setIsLoading] = useState(true)
	const [isExporting, setIsExporting] = useState(false)
	const [error, setError] = useState(null)

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

	const filterParams = useCallback(
		() => ({
			eventType: eventType || undefined,
			fromDate: fromDate || undefined,
			toDate: toDate || undefined,
			q: search || undefined,
		}),
		[eventType, fromDate, toDate, search],
	)

	const load = useCallback(
		async (p = 1) => {
			setIsLoading(true)
			setError(null)
			try {
				const result = await auditLogService.list({
					page: p,
					pageSize: PAGE_SIZE,
					...filterParams(),
				})
				setItems(result.items ?? [])
				setTotal(result.total ?? 0)
				setPage(p)
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load audit log.')
			} finally {
				setIsLoading(false)
			}
		},
		[filterParams],
	)

	useEffect(() => {
		auditLogService.listEventTypes().then(setEventTypes).catch(() => {})
		load(1)
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	function applyFilters() {
		load(1)
	}

	async function handleExport() {
		setIsExporting(true)
		setError(null)
		try {
			await auditLogService.exportCsv(filterParams())
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to export audit log.')
		} finally {
			setIsExporting(false)
		}
	}

	return (
		<div className="space-y-6">
			<div className="rounded-surface border border-border bg-card p-4 shadow-xs">
				<div className="flex flex-col gap-4">
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<label className="space-y-1.5 text-xs">
							<span className="font-medium text-muted-foreground">Event type</span>
							<select
								className="flex h-9 w-full rounded-input border border-border bg-background px-3 text-sm shadow-none"
								value={eventType}
								onChange={(e) => setEventType(e.target.value)}
							>
								<option value="">All events</option>
								{eventTypes.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</label>
						<label className="space-y-1.5 text-xs">
							<span className="font-medium text-muted-foreground">From date</span>
							<Input
								type="date"
								className="h-9 shadow-none"
								value={fromDate}
								onChange={(e) => setFromDate(e.target.value)}
							/>
						</label>
						<label className="space-y-1.5 text-xs">
							<span className="font-medium text-muted-foreground">To date</span>
							<Input
								type="date"
								className="h-9 shadow-none"
								value={toDate}
								onChange={(e) => setToDate(e.target.value)}
							/>
						</label>
						<label className="space-y-1.5 text-xs">
							<span className="font-medium text-muted-foreground">Search detail</span>
							<Input
								type="search"
								placeholder="Note or email…"
								className="h-9 shadow-none"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
							/>
						</label>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<span className="text-xs tabular-nums text-muted-foreground">
							{isLoading ? 'Loading…' : `${total} event${total !== 1 ? 's' : ''}`}
						</span>
						<div className="flex flex-wrap gap-2">
							<Button
								size="sm"
								className="h-9 text-xs shadow-none"
								onClick={applyFilters}
								disabled={isLoading}
							>
								Apply filters
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="h-9 gap-2 border-border/70 text-xs shadow-none"
								onClick={() => load(page)}
								disabled={isLoading}
							>
								<RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
								Refresh
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="h-9 gap-2 border-border/70 text-xs shadow-none"
								onClick={handleExport}
								disabled={isLoading || isExporting}
							>
								<Download className="size-3.5" aria-hidden />
								{isExporting ? 'Exporting…' : 'Export CSV'}
							</Button>
						</div>
					</div>
				</div>
			</div>

			{error && <p className="text-sm text-destructive">{error}</p>}

			<div className="overflow-x-auto rounded-surface border border-border bg-card shadow-xs">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border/60 text-left">
							{['When', 'Event', 'Actor', 'Target', 'Resource', 'Detail', 'IP'].map((col) => (
								<th
									key={col}
									className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70"
								>
									{col}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-border/40">
						{isLoading ? (
							Array.from({ length: 5 }).map((_, i) => (
								<tr key={i}>
									{Array.from({ length: 7 }).map((__, j) => (
										<td key={j} className="px-4 py-3">
											<div className="h-3 w-16 animate-pulse rounded bg-muted" />
										</td>
									))}
								</tr>
							))
						) : items.length === 0 ? (
							<tr>
								<td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
									No audit events match your filters.
								</td>
							</tr>
						) : (
							items.map((event) => (
								<tr key={event.event_id} className="align-top">
									<td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
										{formatDate(event.created_at)}
									</td>
									<td className="px-4 py-3">
										<Badge variant="secondary" className="text-[11px] font-normal">
											{event.event_label}
										</Badge>
									</td>
									<td className="px-4 py-3 text-xs">{actorLabel(event)}</td>
									<td className="px-4 py-3 text-xs">{targetLabel(event)}</td>
									<td className="px-4 py-3 text-xs text-muted-foreground">
										{event.resource_type
											? `${event.resource_type}${event.resource_id ? ` #${event.resource_id}` : ''}`
											: '—'}
									</td>
									<td className="max-w-[200px] truncate px-4 py-3 text-xs text-muted-foreground" title={event.detail ?? ''}>
										{event.detail || '—'}
									</td>
									<td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
										{event.ip_address || '—'}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="flex items-center justify-between">
					<Button
						variant="outline"
						size="sm"
						className="h-9 text-xs shadow-none"
						disabled={page <= 1 || isLoading}
						onClick={() => load(page - 1)}
					>
						Previous
					</Button>
					<span className="text-xs text-muted-foreground">
						Page {page} of {totalPages}
					</span>
					<Button
						variant="outline"
						size="sm"
						className="h-9 text-xs shadow-none"
						disabled={page >= totalPages || isLoading}
						onClick={() => load(page + 1)}
					>
						Next
					</Button>
				</div>
			)}
		</div>
	)
}
