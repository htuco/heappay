import api, { getApiErrorMessage } from '@/utils/api'
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
	 * Create a new transaction.
	 * The sender card must belong to the current user.
	 * @param {import('@/types/transaction').CreateTransactionPayload} payload
	 * @returns {Promise<import('@/types/transaction').Transaction>}
	 */
	async create(payload) {
		try {
			const { data } = await api.post('/transactions', payload)
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
	 * (Staff) List transactions for a specific user (paginated).
	 * @param {number} userId
	 * @param {{ page?: number, pageSize?: number }} [params]
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
}

export default transactionsService
