import api, { getApiErrorMessage } from '@/utils/api'
import { USER_ROLE_API_ERROR_CODES } from '@/types/userRole'

/**
 * @param {import('axios').AxiosResponse['data'] | undefined} response
 */
function httpErrorText(response) {
	const data = response?.data
	if (typeof data?.message === 'string') return data.message
	if (typeof data?.detail === 'string') return data.detail
	return ''
}

/**
 * @param {unknown} rawError
 * @returns {import('@/types/userRole').UserRoleServiceError}
 */
function mapUserRoleApiError(rawError) {
	const error = /** @type {{ response?: { status?: number, data?: unknown } }} */ (rawError)
	const status = error?.response?.status
	const msg = httpErrorText(error?.response)

	if (status === 404) {
		return {
			code: USER_ROLE_API_ERROR_CODES.NOT_FOUND,
			status,
			message: msg || 'User role not found.',
			details: error?.response?.data,
		}
	}

	if (status === 409) {
		const inUse =
			msg.includes('assigned') ||
			msg.includes('one or more users') ||
			msg.includes('Cannot delete role')
		return {
			code: inUse ? USER_ROLE_API_ERROR_CODES.IN_USE : USER_ROLE_API_ERROR_CODES.CONFLICT,
			status,
			message: msg || 'Conflict.',
			details: error?.response?.data,
		}
	}

	if (status === 400 || status === 422) {
		return {
			code: USER_ROLE_API_ERROR_CODES.VALIDATION_ERROR,
			status,
			message: msg || getApiErrorMessage(error, 'Validation failed'),
			details: error?.response?.data,
		}
	}

	if (!error?.response) {
		return {
			code: USER_ROLE_API_ERROR_CODES.NETWORK_ERROR,
			message: getApiErrorMessage(error, 'Network error'),
		}
	}

	return {
		code: USER_ROLE_API_ERROR_CODES.UNKNOWN_ERROR,
		status,
		message: getApiErrorMessage(error, 'User role request failed'),
		details: error?.response?.data,
	}
}

export const userRolesService = {
	/**
	 * @returns {Promise<import('@/types/userRole').UserRole[]>}
	 */
	async list() {
		try {
			const { data } = await api.get('/user-roles')
			return data
		} catch (error) {
			throw mapUserRoleApiError(error)
		}
	},

	/**
	 * @param {number} roleId
	 * @returns {Promise<import('@/types/userRole').UserRole>}
	 */
	async getById(roleId) {
		try {
			const { data } = await api.get(`/user-roles/${roleId}`)
			return data
		} catch (error) {
			throw mapUserRoleApiError(error)
		}
	},

	/**
	 * @param {import('@/types/userRole').CreateUserRolePayload} payload
	 * @returns {Promise<import('@/types/userRole').UserRole>}
	 */
	async create(payload) {
		try {
			const { data } = await api.post('/user-roles', {
				role_name: payload.role_name,
			})
			return data
		} catch (error) {
			throw mapUserRoleApiError(error)
		}
	},

	/**
	 * @param {number} roleId
	 * @param {import('@/types/userRole').UpdateUserRolePayload} payload
	 * @returns {Promise<import('@/types/userRole').UserRole>}
	 */
	async update(roleId, payload) {
		try {
			const { data } = await api.patch(`/user-roles/${roleId}`, {
				role_name: payload.role_name,
			})
			return data
		} catch (error) {
			throw mapUserRoleApiError(error)
		}
	},

	/**
	 * @param {number} roleId
	 * @returns {Promise<void>}
	 */
	async delete(roleId) {
		try {
			await api.delete(`/user-roles/${roleId}`)
		} catch (error) {
			throw mapUserRoleApiError(error)
		}
	},
}

export default userRolesService
