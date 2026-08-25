import { useCallback, useEffect, useState } from 'react'
import { Calendar, Download, RefreshCw, Search } from 'lucide-react'

import AuditEventBadge from '@/components/admin/AuditEventBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import auditLogService from '@/services/auditLogService'

const PAGE_SIZE = 20

const COLUMNS = ['When', 'Event', 'Actor', 'Target', 'Resource', 'Detail', 'IP']

// Control recipe shared by every filter field, so the row reads as one bar.
// Mirrors the transaction-history toolbar: h-9 at md+, 44px touch target below.
const FIELD_CLASS = 'h-9 border-border/70 bg-background text-sm shadow-none'

function formatDate(iso) {
	if (!iso) return null
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
	return null
}

function targetLabel(event) {
	if (event.target_name) return event.target_name
	if (event.target_email) return event.target_email
	if (event.target_user_id) return `User #${event.target_user_id}`
	return null
}

function resourceLabel(event) {
	if (!event.resource_type) return null
	return `${event.resource_type}${event.resource_id ? ` #${event.resource_id}` : ''}`
}

/**
 * Placeholder for a cell with no value. Login events carry no actor, target or
 * resource, so most rows have several — dimmed well below the body text so the
 * cells that *do* hold data are what the eye lands on. Hidden from assistive
 * tech: an empty cell is the honest reading, "em dash" is noise.
 */
function EmptyCell() {
	return (
		<span className="text-muted-foreground/40" aria-hidden="true">
			—
		</span>
	)
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
						<label className="space-y-1.5">
							<span className="text-xs font-medium text-muted-foreground">Event type</span>
							<Select
								value={eventType}
								onChange={(e) => setEventType(e.target.value)}
								options={[{ value: '', label: 'All events' }, ...eventTypes]}
								className={`${FIELD_CLASS} py-0`}
							/>
						</label>

						<label className="space-y-1.5">
							<span className="text-xs font-medium text-muted-foreground">From date</span>
							<div className="relative">
								<Calendar
									className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
									aria-hidden="true"
								/>
								<Input
									type="date"
									className={`${FIELD_CLASS} pl-8`}
									value={fromDate}
									onChange={(e) => setFromDate(e.target.value)}
								/>
							</div>
						</label>

						<label className="space-y-1.5">
							<span className="text-xs font-medium text-muted-foreground">To date</span>
							<div className="relative">
								<Calendar
									className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
									aria-hidden="true"
								/>
								<Input
									type="date"
									className={`${FIELD_CLASS} pl-8`}
									value={toDate}
									onChange={(e) => setToDate(e.target.value)}
								/>
							</div>
						</label>

						<label className="space-y-1.5">
							<span className="text-xs font-medium text-muted-foreground">Search detail</span>
							<div className="relative">
								<Search
									className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
									aria-hidden="true"
								/>
								<Input
									type="search"
									placeholder="Note or email…"
									className={`${FIELD_CLASS} pl-8 placeholder:text-muted-foreground/50`}
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
								/>
							</div>
						</label>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<span className="text-xs tabular-nums text-muted-foreground">
							{isLoading ? 'Loading…' : `${total} event${total !== 1 ? 's' : ''}`}
						</span>
						<div className="flex flex-wrap gap-2">
							<Button size="lg" onClick={applyFilters} disabled={isLoading}>
								Apply filters
							</Button>
							<Button
								variant="outline"
								size="lg"
								className="gap-2 border-border/70"
								onClick={() => load(page)}
								disabled={isLoading}
							>
								<RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
								Refresh
							</Button>
							<Button
								variant="outline"
								size="lg"
								className="gap-2 border-border/70"
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
							{COLUMNS.map((col) => (
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
									{COLUMNS.map((col) => (
										<td key={col} className="px-4 py-3">
											<div className="h-3 w-16 animate-pulse rounded bg-muted" />
										</td>
									))}
								</tr>
							))
						) : items.length === 0 ? (
							<tr>
								<td
									colSpan={COLUMNS.length}
									className="px-4 py-12 text-center text-sm text-muted-foreground"
								>
									No audit events match your filters.
								</td>
							</tr>
						) : (
							items.map((event) => {
								const actor = actorLabel(event)
								const target = targetLabel(event)
								const resource = resourceLabel(event)

								return (
									<tr key={event.event_id} className="transition-colors hover:bg-muted/30">
										<td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-muted-foreground">
											{formatDate(event.created_at) ?? <EmptyCell />}
										</td>
										<td className="px-4 py-3">
											<AuditEventBadge event={event} />
										</td>
										<td className="px-4 py-3 text-xs text-foreground">
											{actor ?? <EmptyCell />}
										</td>
										<td className="px-4 py-3 text-xs text-foreground">
											{target ?? <EmptyCell />}
										</td>
										<td className="px-4 py-3 text-xs text-muted-foreground">
											{resource ?? <EmptyCell />}
										</td>
										<td
											className="max-w-[200px] truncate px-4 py-3 text-xs text-muted-foreground"
											title={event.detail ?? ''}
										>
											{event.detail || <EmptyCell />}
										</td>
										<td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-muted-foreground">
											{event.ip_address || <EmptyCell />}
										</td>
									</tr>
								)
							})
						)}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="flex items-center justify-between">
					<Button
						variant="outline"
						size="lg"
						className="border-border/70"
						disabled={page <= 1 || isLoading}
						onClick={() => load(page - 1)}
					>
						Previous
					</Button>
					<span className="text-xs tabular-nums text-muted-foreground">
						Page {page} of {totalPages}
					</span>
					<Button
						variant="outline"
						size="lg"
						className="border-border/70"
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
