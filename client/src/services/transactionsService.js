import api, { getApiErrorMessage } from '@/utils/api'
import { normalizeAmountForSubmit } from '@/utils/amount'
import { TRANSACTION_API_ERROR_CODES } from '@/types/transaction'

const DETAIL_TO_ERROR_CODE = {
	'Transaction not found.': TRANSACTION_API_ERROR_CODES.NOT_FOUND,
	'One of the referenced cards was not found.': TRANSACTION_API_ERROR_CODES.CARD_NOT_FOUND,
	'Transaction type not found.': TRANSACTION_API_ERROR_CODES.TYPE_NOT_FOUND,
	'Transaction status not found.': TRANSACTION_API_ERROR_CODES.STATUS_NOT_FOUND,
	'Sender card has insufficient balance.': TRANSACTION_API_ERROR_CODES.INSUFFICIENT_BALANCE,
	'You do not have access to this resource.': TRANSACTION_API_ERROR_CODES.FORBIDDEN,
}

/**
 * @param {{ data?: { message?: unknown, detail?: unknown } } | undefined} response
 * @returns {string}
 */
function httpErrorText(response) {
	const data = response?.data
	if (typeof data?.message === 'string' && data.message.trim()) return data.message
	if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail
	return ''
}

/**
 * @param {unknown} rawError
 * @returns {import('@/types/transaction').TransactionServiceError}
 */
function mapTransactionApiError(rawError) {
	const error = /** @type {{ response?: { status?: number, data?: unknown } }} */ (rawError)
	const status = error?.response?.status
	const data = error?.response?.data
	const msg = httpErrorText(error?.response)

	if (status === 403) {
		return {
			code: TRANSACTION_API_ERROR_CODES.FORBIDDEN,
			status,
			message: msg || 'You do not have access to this resource.',
			details: data,
		}
	}

	if (msg && DETAIL_TO_ERROR_CODE[msg]) {
		return {
			code: DETAIL_TO_ERROR_CODE[msg],
			status,
			message: msg,
			details: data,
		}
	}

	if (status === 400 || status === 422) {
		return {
			code: TRANSACTION_API_ERROR_CODES.VALIDATION_ERROR,
			status,
			message: msg || getApiErrorMessage(error, 'Validation failed'),
			details: data,
		}
	}

	if (!error?.response) {
		return {
			code: TRANSACTION_API_ERROR_CODES.NETWORK_ERROR,
			message: getApiErrorMessage(error, 'Network error'),
		}
	}

	return {
		code: TRANSACTION_API_ERROR_CODES.UNKNOWN_ERROR,
		status,
		message: getApiErrorMessage(error, 'Transaction request failed'),
		details: data,
	}
}

/**
 * @param {{ page?: number, pageSize?: number }} [params]
 * @returns {Record<string, number>}
 */
function buildPageParams(params = {}) {
	const query = {}
	if (typeof params.page === 'number') query.page = params.page
	if (typeof params.pageSize === 'number') query.page_size = params.pageSize
	if (typeof params.statusId === 'number') query.status_id = params.statusId
	if (typeof params.transactionTypeId === 'number') query.transaction_type_id = params.transactionTypeId
	if (typeof params.categoryId === 'number') query.category_id = params.categoryId
	if (typeof params.fromDate === 'string' && params.fromDate) query.from_date = params.fromDate
	if (typeof params.toDate === 'string' && params.toDate) query.to_date = params.toDate
	if (typeof params.userRoleName === 'string' && params.userRoleName) {
		query.user_role_name = params.userRoleName
	}
	if (typeof params.sort === 'string') query.sort = params.sort
	return query
}

export const transactionsService = {
	/**
	 * Aggregate income / expense per calendar month for the current user.
	 * Returns newest month first.
	 * @param {import('@/types/transaction').GetSummaryParams} [params]
	 * @returns {Promise<import('@/types/transaction').TransactionSummary>}
	 */
	async getSummary(params = {}) {
		try {
			const query = {}
			if (typeof params.months === 'number') query.months = params.months
			const { data } = await api.get('/transactions/summary', { params: query })
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Outgoing spend grouped by category for the current user over the window.
	 * Includes an "Uncategorised" bucket (category_id null) so segments reconcile
	 * to total outgoing.
	 * @param {{ months?: number }} [params]
	 * @returns {Promise<{ items: Array<{ category_id: number | null, name: string, total: string, count: number }>, months: number }>}
	 */
	async summaryByCategory(params = {}) {
		try {
			const query = {}
			if (typeof params.months === 'number') query.months = params.months
			const { data } = await api.get('/transactions/summary/by-category', { params: query })
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Month-on-month outgoing spend per category over a trailing window.
	 * `range` uses the shared '7d'|'30d'|'90d'|'1y' vocabulary. Returns a
	 * chronological `periods` axis plus one `series` per category whose `points`
	 * line up with that axis (0 for a month with no spend).
	 * @param {{ range?: '7d'|'30d'|'90d'|'1y' }} [params]
	 * @returns {Promise<{ range: string, periods: string[], series: Array<{ category_id: number | null, name: string, total: string, points: string[] }> }>}
	 */
	async summaryByCategoryTimeseries(params = {}) {
		try {
			const query = {}
			if (typeof params.range === 'string' && params.range) query.range = params.range
			const { data } = await api.get('/transactions/summary/by-category/timeseries', {
				params: query,
			})
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * List the current user's transactions (paginated).
	 * @param {import('@/types/transaction').ListTransactionsParams} [params]
	 * @returns {Promise<import('@/types/transaction').TransactionPage>}
	 */
	async list(params = {}) {
		try {
			const { data } = await api.get('/transactions', { params: buildPageParams(params) })
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Admin) List every transaction in the system (paginated).
	 * @param {import('@/types/transaction').ListTransactionsParams} [params]
	 * @returns {Promise<import('@/types/transaction').TransactionPage>}
	 */
	async listAll(params = {}) {
		try {
			const { data } = await api.get('/transactions/all', { params: buildPageParams(params) })
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Fetch a single transaction by ID.
	 * Throws FORBIDDEN if the transaction belongs to another user.
	 * @param {number} transactionId
	 * @returns {Promise<import('@/types/transaction').Transaction>}
	 */
	async getById(transactionId) {
		try {
			const { data } = await api.get(`/transactions/${transactionId}`)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * List paginated transactions where the given card appears as sender or recipient.
	 * The card must belong to the current user.
	 * @param {number} cardId
	 * @param {import('@/types/transaction').ListByCardParams} [params]
	 * @returns {Promise<import('@/types/transaction').TransactionPage>}
	 */
	async listByCard(cardId, params = {}) {
		try {
			const { data } = await api.get(`/transactions/card/${cardId}`, {
				params: buildPageParams(params),
			})
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Start biometric verification before creating a transaction.
	 * @returns {Promise<{ challenge_id: number, publicKey: object }>}
	 */
	async beginBiometricTransactionVerification() {
		try {
			const { data } = await api.post('/transactions/biometric/options')
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Create a new transaction.
	 * The sender card must belong to the current user.
	 * @param {import('@/types/transaction').CreateTransactionPayload & { biometric?: { challenge_id: number, credential: object } }} payload
	 * @returns {Promise<import('@/types/transaction').Transaction>}
	 */
	async create(payload) {
		try {
			const normalizedAmount = normalizeAmountForSubmit(payload.amount)
			if (!normalizedAmount) {
				throw {
					code: TRANSACTION_API_ERROR_CODES.VALIDATION_ERROR,
					message: 'Enter a valid amount with up to 2 decimal places.',
				}
			}
			const { data } = await api.post('/transactions', {
				...payload,
				amount: normalizedAmount,
			})
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Start biometric verification for a sensitive pending payment.
	 * @param {number} transactionId
	 * @returns {Promise<{ challenge_id: number, publicKey: object }>}
	 */
	async beginBiometricApproval(transactionId) {
		try {
			const { data } = await api.post(`/transactions/${transactionId}/approval/biometric/options`)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Confirm a sensitive pending payment with step-up verification.
	 * @param {number} transactionId
	 * @param {{ totp_code?: string, password?: string, biometric?: { challenge_id: number, credential: object } }} payload
	 * @returns {Promise<import('@/types/transaction').Transaction>}
	 */
	async approve(transactionId, payload) {
		try {
			const { data } = await api.post(`/transactions/${transactionId}/approve`, payload)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Audit trail for in-app payment approval on a transaction.
	 * @param {number} transactionId
	 * @returns {Promise<Array<{ event_id: number, event_type: string, created_at: string, verification_method?: string, detail?: string }>>}
	 */
	async listApprovalEvents(transactionId) {
		try {
			const { data } = await api.get(`/transactions/${transactionId}/approval-events`)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Update the status or note of an existing transaction.
	 * @param {number} transactionId
	 * @param {import('@/types/transaction').PatchTransactionPayload} payload
	 * @returns {Promise<import('@/types/transaction').Transaction>}
	 */
	async patch(transactionId, payload) {
		try {
			const { data } = await api.patch(`/transactions/${transactionId}`, payload)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Staff) Update a transaction for any user.
	 * @param {number} transactionId
	 * @param {import('@/types/transaction').PatchTransactionPayload} payload
	 * @returns {Promise<import('@/types/transaction').Transaction>}
	 */
	async patchAsStaff(transactionId, payload) {
		try {
			const { data } = await api.patch(`/transactions/${transactionId}/staff`, payload)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Staff) Look up any transaction by id, with no ownership check.
	 * @param {number} transactionId
	 * @returns {Promise<import('@/types/transaction').Transaction>}
	 */
	async getByIdAsStaff(transactionId) {
		try {
			const { data } = await api.get(`/transactions/${transactionId}/staff`)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Staff) List transactions for a specific user (paginated).
	 * @param {number} userId
	 * @param {{ page?: number, pageSize?: number, statusId?: number, transactionTypeId?: number, sort?: string }} [params]
	 * @returns {Promise<import('@/types/transaction').TransactionPage>}
	 */
	async listForUser(userId, params = {}) {
		try {
			const { data } = await api.get(`/transactions/user/${userId}`, { params: buildPageParams(params) })
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Staff) List refund requests for a specific user (paginated).
	 * @param {number} userId
	 * @param {{ page?: number, pageSize?: number }} [params]
	 * @returns {Promise<object>}
	 */
	async listRefundsForUser(userId, params = {}) {
		try {
			const { data } = await api.get(`/requests/user/${userId}`, { params: buildPageParams(params) })
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Submit a refund request for a completed outgoing transaction.
	 * @param {number} transactionId
	 * @param {string} reasonCode
	 * @param {string | null} [note]
	 * @returns {Promise<object>}
	 */
	async requestRefund(transactionId, reasonCode, note = null) {
		try {
			const { data } = await api.post('/requests/refund', {
				transaction_id: transactionId,
				reason_code: reasonCode,
				note,
			})
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Admin) Approve a pending refund request.
	 * @param {number} requestId
	 * @returns {Promise<object>}
	 */
	async approveRefund(requestId) {
		try {
			const { data } = await api.post(`/requests/${requestId}/approve`)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Admin) Decline a pending refund request.
	 * @param {number} requestId
	 * @returns {Promise<object>}
	 */
	async declineRefund(requestId) {
		try {
			const { data } = await api.post(`/requests/${requestId}/decline`)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Admin) List all pending refund requests (paginated).
	 * @param {{ page?: number, pageSize?: number }} [params]
	 * @returns {Promise<object>}
	 */
	async listPendingRefunds(params = {}) {
		try {
			const { data } = await api.get('/requests/refunds/pending', { params: buildPageParams(params) })
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Staff) List refund requests, optionally filtered by status (paginated).
	 * @param {{ page?: number, pageSize?: number, statusId?: number }} [params]
	 * @returns {Promise<object>}
	 */
	async listRefunds(params = {}) {
		try {
			const { data } = await api.get('/requests', { params: buildPageParams(params) })
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Staff) Refund request counts by status.
	 * @returns {Promise<{ pending: number, approved: number, declined: number, cancelled: number, total: number }>}
	 */
	async getRequestStats() {
		try {
			const { data } = await api.get('/requests/stats')
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Admin) Get the current refund auto-approval rules.
	 * @returns {Promise<object>}
	 */
	async getRefundApprovalRules() {
		try {
			const { data } = await api.get('/refund-approval-rules')
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Admin) Update the refund auto-approval rules.
	 * @param {{ enabled: boolean, maxAgeDays: number }} payload
	 * @returns {Promise<object>}
	 */
	async updateRefundApprovalRules({ enabled, maxAgeDays }) {
		try {
			const { data } = await api.put('/refund-approval-rules', {
				enabled,
				max_age_days: maxAgeDays,
			})
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Request that one of the user's own cards be frozen (e.g. lost/stolen).
	 * Staff approve the request, which freezes the card.
	 * @param {number} cardId
	 * @param {string | null} [note]
	 * @returns {Promise<object>}
	 */
	async requestCardFreeze(cardId, note = null) {
		try {
			const { data } = await api.post('/requests/card-freeze', { card_id: cardId, note })
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Staff) Approve a pending freeze request — sets the target card to frozen.
	 * @param {number} requestId
	 * @returns {Promise<object>}
	 */
	async approveCardFreeze(requestId) {
		try {
			const { data } = await api.post(`/requests/${requestId}/approve-freeze`)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Staff) Decline a pending freeze request.
	 * @param {number} requestId
	 * @returns {Promise<object>}
	 */
	async declineCardFreeze(requestId) {
		try {
			const { data } = await api.post(`/requests/${requestId}/decline-freeze`)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Staff) List card freeze + unfreeze requests, optionally filtered by status.
	 * @param {{ page?: number, pageSize?: number, statusId?: number }} [params]
	 * @returns {Promise<object>}
	 */
	async listCardFreezes(params = {}) {
		try {
			const { data } = await api.get('/requests/freezes', { params: buildPageParams(params) })
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Request that one of the user's own frozen cards be unfrozen.
	 * @param {number} cardId
	 * @param {string | null} [note]
	 * @returns {Promise<object>}
	 */
	async requestCardUnfreeze(cardId, note = null) {
		try {
			const { data } = await api.post('/requests/card-unfreeze', { card_id: cardId, note })
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Staff) Approve a pending unfreeze request — sets the card back to active.
	 * @param {number} requestId
	 * @returns {Promise<object>}
	 */
	async approveCardUnfreeze(requestId) {
		try {
			const { data } = await api.post(`/requests/${requestId}/approve-unfreeze`)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Staff) Decline a pending unfreeze request.
	 * @param {number} requestId
	 * @returns {Promise<object>}
	 */
	async declineCardUnfreeze(requestId) {
		try {
			const { data } = await api.post(`/requests/${requestId}/decline-unfreeze`)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * (Admin) Platform-wide transaction stats for the admin overview.
	 * @param {{ months?: number }} [params]
	 * @returns {Promise<{ monthly: Array<{ period: string, count: number, volume: string }>, by_status: Record<string, number>, by_type: Record<string, number>, total_count: number, completed_volume: string, months: number }>}
	 */
	async getTransactionStats(params = {}) {
		try {
			const query = {}
			if (typeof params.months === 'number') query.months = params.months
			if (typeof params.statusId === 'number') query.status_id = params.statusId
			if (typeof params.transactionTypeId === 'number') {
				query.transaction_type_id = params.transactionTypeId
			}
			if (typeof params.fromDate === 'string' && params.fromDate) query.from_date = params.fromDate
			if (typeof params.toDate === 'string' && params.toDate) query.to_date = params.toDate
			if (typeof params.userRoleName === 'string' && params.userRoleName) {
				query.user_role_name = params.userRoleName
			}
			const { data } = await api.get('/transactions/stats', { params: query })
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Ask another user to pay you. Creates a pending money request.
	 * @param {{ targetUserId: number, amount: string, note?: string | null }} payload
	 * @returns {Promise<object>}
	 */
	async requestMoney({ targetUserId, amount, note = null }) {
		try {
			const { data } = await api.post('/requests/money', {
				target_user_id: targetUserId,
				amount,
				note,
			})
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Pending money requests addressed to the current user (paginated).
	 * @param {{ page?: number, pageSize?: number }} [params]
	 * @returns {Promise<object>}
	 */
	async listIncomingMoneyRequests(params = {}) {
		try {
			const { data } = await api.get('/requests/money/incoming', {
				params: buildPageParams(params),
			})
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Money requests the current user has sent (paginated).
	 * @param {{ page?: number, pageSize?: number }} [params]
	 * @returns {Promise<object>}
	 */
	async listOutgoingMoneyRequests(params = {}) {
		try {
			const { data } = await api.get('/requests/money/outgoing', {
				params: buildPageParams(params),
			})
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Pay a pending money request addressed to the current user.
	 * @param {number} requestId
	 * @param {{ sender_card_id: number, biometric?: object, app_pin?: string, totp_code?: string, password?: string }} payload
	 * @returns {Promise<object>}
	 */
	async payMoneyRequest(requestId, payload) {
		try {
			const { data } = await api.post(`/requests/money/${requestId}/pay`, payload)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},

	/**
	 * Decline a pending money request addressed to the current user.
	 * @param {number} requestId
	 * @returns {Promise<object>}
	 */
	async declineMoneyRequest(requestId) {
		try {
			const { data } = await api.post(`/requests/money/${requestId}/decline`)
			return data.data
		} catch (error) {
			throw mapTransactionApiError(error)
		}
	},
}

export default transactionsService
