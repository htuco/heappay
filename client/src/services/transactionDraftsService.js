import api, { getApiErrorMessage } from '@/utils/api'

/**
 * Drafts are payments the user saved to finish later. Saving one moves no
 * money — only `send` does, and it goes through the ordinary transaction
 * create path on the server, which is why its errors read exactly like the
 * wizard's own send errors.
 */

function mapError(error, fallback) {
	const status = error?.response?.status
	const data = error?.response?.data
	const message =
		(typeof data?.message === 'string' && data.message) ||
		(typeof data?.detail === 'string' && data.detail) ||
		''

	if (!error?.response) {
		return { code: 'NETWORK_ERROR', message: getApiErrorMessage(error, 'Network error') }
	}
	return {
		code:
			status === 403
				? 'FORBIDDEN'
				: status === 404
					? 'NOT_FOUND'
					: status === 409
						? 'CONFLICT'
						: 'UNKNOWN_ERROR',
		status,
		message: message || getApiErrorMessage(error, fallback),
		details: data,
	}
}

export const transactionDraftsService = {
	async list() {
		try {
			const { data } = await api.get('/transaction-drafts')
			return data.data
		} catch (error) {
			throw mapError(error, "Couldn't load your drafts")
		}
	},

	async getById(draftId) {
		try {
			const { data } = await api.get(`/transaction-drafts/${draftId}`)
			return data.data
		} catch (error) {
			throw mapError(error, "Couldn't load this draft")
		}
	},

	async create(payload) {
		try {
			const { data } = await api.post('/transaction-drafts', payload)
			return data.data
		} catch (error) {
			throw mapError(error, "Couldn't save this draft")
		}
	},

	async update(draftId, payload) {
		try {
			const { data } = await api.patch(`/transaction-drafts/${draftId}`, payload)
			return data.data
		} catch (error) {
			throw mapError(error, "Couldn't save this draft")
		}
	},

	async remove(draftId) {
		try {
			const { data } = await api.delete(`/transaction-drafts/${draftId}`)
			return data
		} catch (error) {
			throw mapError(error, "Couldn't discard this draft")
		}
	},

	/**
	 * Send a saved draft. Payment fields are optional overrides — anything left
	 * out falls back to what the draft stored. The draft survives every failure,
	 * so the caller can fix the problem and try the same draft again.
	 */
	async send(draftId, payload = {}) {
		try {
			const { data } = await api.post(`/transaction-drafts/${draftId}/send`, payload)
			return data.data
		} catch (error) {
			throw mapError(error, 'Payment failed. Please check the details and try again.')
		}
	},
}

export default transactionDraftsService
