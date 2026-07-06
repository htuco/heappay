import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
	TX_FILTER_DEFAULTS,
	filtersToSearchParams,
	parseTransactionFilters,
} from '@/utils/transactionFilterParams'

/**
 * URL-synced transaction filters shared by admin charts/tables and consumer history.
 */
export function useTransactionFilterParams({ includeSort = true } = {}) {
	const [searchParams, setSearchParams] = useSearchParams()

	const filters = useMemo(
		() => parseTransactionFilters(searchParams),
		[searchParams],
	)

	const setFilters = useCallback(
		(patch) => {
			const next = { ...filters, ...patch }
			Object.keys(TX_FILTER_DEFAULTS).forEach((key) => {
				if (!(key in patch)) return
				const value = patch[key]
				if (value === '' || value == null || (key === 'sort' && value === 'newest')) {
					next[key] = key === 'sort' ? 'newest' : ''
				}
			})
			const params = new URLSearchParams(searchParams)
			;['status', 'type', 'from', 'to', 'segment', 'sort'].forEach((key) => params.delete(key))
			filtersToSearchParams(next, { includeSort }).forEach((value, key) => {
				params.set(key, value)
			})
			setSearchParams(params, { replace: true })
		},
		[filters, includeSort, searchParams, setSearchParams],
	)

	const clearFilters = useCallback(() => {
		const params = new URLSearchParams(searchParams)
		;['status', 'type', 'from', 'to', 'segment', 'sort'].forEach((key) => params.delete(key))
		setSearchParams(params, { replace: true })
	}, [searchParams, setSearchParams])

	const hasActiveFilters = useMemo(
		() =>
			Boolean(filters.status || filters.type || filters.from || filters.to || filters.segment)
			|| (includeSort && filters.sort !== 'newest'),
		[filters, includeSort],
	)

	return { filters, setFilters, clearFilters, hasActiveFilters }
}
