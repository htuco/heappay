const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const TX_FILTER_DEFAULTS = {
	status: '',
	type: '',
	from: '',
	to: '',
	segment: '',
	sort: 'newest',
}

export const TX_SEGMENT_OPTIONS = [
	{ value: '', label: 'All users' },
	{ value: 'user', label: 'Consumers' },
	{ value: 'admin', label: 'Admins' },
	{ value: 'support', label: 'Support' },
]

export const TX_SORT_OPTIONS = [
	{ value: 'newest', label: 'Newest first' },
	{ value: 'oldest', label: 'Oldest first' },
	{ value: 'amount_desc', label: 'Amount high → low' },
	{ value: 'amount_asc', label: 'Amount low → high' },
]

export function parseTransactionFilters(searchParams) {
	const read = (key) => searchParams.get(key)?.trim() ?? ''
	const from = read('from')
	const to = read('to')
	return {
		status: read('status'),
		type: read('type'),
		from: ISO_DATE.test(from) ? from : '',
		to: ISO_DATE.test(to) ? to : '',
		segment: read('segment'),
		sort: read('sort') || TX_FILTER_DEFAULTS.sort,
	}
}

export function filtersToSearchParams(filters, { includeSort = true } = {}) {
	const params = new URLSearchParams()
	if (filters.status) params.set('status', filters.status)
	if (filters.type) params.set('type', filters.type)
	if (filters.from) params.set('from', filters.from)
	if (filters.to) params.set('to', filters.to)
	if (filters.segment) params.set('segment', filters.segment)
	if (includeSort && filters.sort && filters.sort !== 'newest') {
		params.set('sort', filters.sort)
	}
	return params
}

export function toApiFilterParams(filters) {
	const params = {}
	if (filters.status) params.statusId = Number(filters.status)
	if (filters.type) params.transactionTypeId = Number(filters.type)
	if (filters.from) params.fromDate = filters.from
	if (filters.to) params.toDate = filters.to
	if (filters.segment) params.userRoleName = filters.segment
	if (filters.sort) params.sort = filters.sort
	return params
}
