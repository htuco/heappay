import api, { getApiErrorMessage } from '@/utils/api'
import { CARD_TYPE_API_ERROR_CODES } from '@/types/cardType'

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
 * @returns {import('@/types/cardType').CardTypeServiceError}
 */
function mapCardTypeApiError(rawError) {
	const error = /** @type {{ response?: { status?: number, data?: unknown } }} */ (
		rawError
	)
	const status = error?.response?.status
	const data = error?.response?.data
	const msg = httpErrorText(error?.response)

	if (status === 404) {
		return {
			code: CARD_TYPE_API_ERROR_CODES.NOT_FOUND,
			status,
			message: msg || 'Card type not found.',
			details: data,
		}
	}

	if (status === 409) {
		const inUse =
			msg.includes('in use') ||
			msg.includes('cannot be deleted') ||
			msg.includes('Card type is in use')
		return {
			code: inUse ? CARD_TYPE_API_ERROR_CODES.IN_USE : CARD_TYPE_API_ERROR_CODES.CONFLICT,
			status,
			message: msg || 'Conflict.',
			details: data,
		}
	}

	if (status === 400 || status === 422) {
		return {
			code: CARD_TYPE_API_ERROR_CODES.VALIDATION_ERROR,
			status,
			message: msg || getApiErrorMessage(error, 'Validation failed'),
			details: data,
		}
	}

	if (!error?.response) {
		return {
			code: CARD_TYPE_API_ERROR_CODES.NETWORK_ERROR,
			message: getApiErrorMessage(error, 'Network error'),
		}
	}

	return {
		code: CARD_TYPE_API_ERROR_CODES.UNKNOWN_ERROR,
		status,
		message: getApiErrorMessage(error, 'Card type request failed'),
		details: data,
	}
}

/**
 * @param {import('@/types/cardType').UpdateCardTypePayload} payload
 */
function buildUpdateBody(payload) {
	const body = {}
	if (payload.type_name !== undefined) body.type_name = payload.type_name
	if (payload.vendor !== undefined) body.vendor = payload.vendor
	return body
}

export const cardTypesService = {
	/**
	 * @returns {Promise<import('@/types/cardType').CardType[]>}
	 */
	async list() {
		try {
			const { data } = await api.get('/card-types')
			return data
		} catch (error) {
			throw mapCardTypeApiError(error)
		}
	},

	/**
	 * @param {number} cardTypeId
	 * @returns {Promise<import('@/types/cardType').CardType>}
	 */
	async getById(cardTypeId) {
		try {
			const { data } = await api.get(`/card-types/${cardTypeId}`)
			return data
		} catch (error) {
			throw mapCardTypeApiError(error)
		}
	},

	/**
	 * @param {import('@/types/cardType').CreateCardTypePayload} payload
	 * @returns {Promise<import('@/types/cardType').CardType>}
	 */
	async create(payload) {
		try {
			const { data } = await api.post('/card-types', {
				type_name: payload.type_name,
				vendor: payload.vendor,
			})
			return data
		} catch (error) {
			throw mapCardTypeApiError(error)
		}
	},

	/**
	 * @param {number} cardTypeId
	 * @param {import('@/types/cardType').UpdateCardTypePayload} payload
	 * @returns {Promise<import('@/types/cardType').CardType>}
	 */
	async update(cardTypeId, payload) {
		try {
			const { data } = await api.patch(`/card-types/${cardTypeId}`, buildUpdateBody(payload))
			return data
		} catch (error) {
			throw mapCardTypeApiError(error)
		}
	},

	/**
	 * @param {number} cardTypeId
	 * @returns {Promise<void>}
	 */
	async delete(cardTypeId) {
		try {
			await api.delete(`/card-types/${cardTypeId}`)
		} catch (error) {
			throw mapCardTypeApiError(error)
		}
	},
}

export default cardTypesService
