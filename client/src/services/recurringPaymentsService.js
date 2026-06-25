import api, { getApiErrorMessage } from '@/utils/api'

function mapError(error) {
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
		code: status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'UNKNOWN_ERROR',
		status,
		message: message || getApiErrorMessage(error, 'Request failed'),
		details: data,
	}
}

export const recurringPaymentsService = {
	async list() {
		try {
			const { data } = await api.get('/recurring-payments')
			return data.data
		} catch (error) {
			throw mapError(error)
		}
	},

	async getById(id) {
		try {
			const { data } = await api.get(`/recurring-payments/${id}`)
			return data.data
		} catch (error) {
			throw mapError(error)
		}
	},

	async create(payload) {
		try {
			const { data } = await api.post('/recurring-payments', payload)
			return data.data
		} catch (error) {
			throw mapError(error)
		}
	},

	async update(id, payload) {
		try {
			const { data } = await api.patch(`/recurring-payments/${id}`, payload)
			return data.data
		} catch (error) {
			throw mapError(error)
		}
	},

	async cancel(id) {
		try {
			const { data } = await api.delete(`/recurring-payments/${id}`)
			return data
		} catch (error) {
			throw mapError(error)
		}
	},
}

export default recurringPaymentsService
