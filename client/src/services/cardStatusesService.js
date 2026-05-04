import api, { getApiErrorMessage } from '@/utils/api'
import {
	CARD_STATUS_API_ERROR_CODES,
	CARD_STATUS_BACKEND_CODES,
} from '@/types/cardStatus'

/**
 * @param {import('axios').AxiosResponse | undefined} response
 */
function httpErrorText(response) {
	const data = response?.data
	if (typeof data?.message === 'string') return data.message
	if (typeof data?.detail === 'string') return data.detail
	return ''
}

/**
 * @param {unknown} rawError
 * @returns {import('@/types/cardStatus').CardStatusServiceError}
 */
function mapCardStatusApiError(rawError) {
	const error = /** @type {{ response?: { status?: number, data?: { code?: string } } }} */ (
		rawError
	)
	const status = error?.response?.status
	const data = error?.response?.data
	const msg = httpErrorText(error?.response)
	const apiCode = typeof data?.code === 'string' ? data.code : ''

	if (status === 404 || apiCode === CARD_STATUS_BACKEND_CODES.NOT_FOUND) {
		return {
			code: CARD_STATUS_API_ERROR_CODES.NOT_FOUND,
			status,
			message: msg || 'Card status not found.',
			details: data,
		}
	}

	if (apiCode === CARD_STATUS_BACKEND_CODES.IN_USE) {
		return {
			code: CARD_STATUS_API_ERROR_CODES.IN_USE,
			status,
			message: msg || 'Card status is in use.',
			details: data,
		}
	}

	if (
		status === 409 ||
		apiCode === CARD_STATUS_BACKEND_CODES.DUPLICATE ||
		msg.includes('already exists')
	) {
		return {
			code: CARD_STATUS_API_ERROR_CODES.CONFLICT,
			status,
			message: msg || 'A card status with this name already exists.',
			details: data,
		}
	}

	if (status === 400 || status === 422) {
		return {
			code: CARD_STATUS_API_ERROR_CODES.VALIDATION_ERROR,
			status,
			message: msg || getApiErrorMessage(error, 'Validation failed'),
			details: data,
		}
	}

	if (!error?.response) {
		return {
			code: CARD_STATUS_API_ERROR_CODES.NETWORK_ERROR,
			message: getApiErrorMessage(error, 'Network error'),
		}
	}

	return {
		code: CARD_STATUS_API_ERROR_CODES.UNKNOWN_ERROR,
		status,
		message: getApiErrorMessage(error, 'Card status request failed'),
		details: data,
	}
}

export const cardStatusesService = {
	/**
	 * @returns {Promise<import('@/types/cardStatus').CardStatus[]>}
	 */
	async list() {
		try {
			const { data } = await api.get('/card-statuses')
			return data
		} catch (error) {
			throw mapCardStatusApiError(error)
		}
	},

	/**
	 * @param {number} cardStatusId
	 * @returns {Promise<import('@/types/cardStatus').CardStatus>}
	 */
	async getById(cardStatusId) {
		try {
			const { data } = await api.get(`/card-statuses/${cardStatusId}`)
			return data
		} catch (error) {
			throw mapCardStatusApiError(error)
		}
	},

	/**
	 * @param {import('@/types/cardStatus').CreateCardStatusPayload} payload
	 * @returns {Promise<import('@/types/cardStatus').CardStatus>}
	 */
	async create(payload) {
		try {
			const { data } = await api.post('/card-statuses', {
				status_name: payload.status_name,
			})
			return data
		} catch (error) {
			throw mapCardStatusApiError(error)
		}
	},

	/**
	 * @param {number} cardStatusId
	 * @param {import('@/types/cardStatus').UpdateCardStatusPayload} payload
	 * @returns {Promise<import('@/types/cardStatus').CardStatus>}
	 */
	async update(cardStatusId, payload) {
		try {
			const { data } = await api.patch(`/card-statuses/${cardStatusId}`, {
				status_name: payload.status_name,
			})
			return data
		} catch (error) {
			throw mapCardStatusApiError(error)
		}
	},

	/**
	 * @param {number} cardStatusId
	 * @returns {Promise<void>}
	 */
	async delete(cardStatusId) {
		try {
			await api.delete(`/card-statuses/${cardStatusId}`)
		} catch (error) {
			throw mapCardStatusApiError(error)
		}
	},
}

export default cardStatusesService
