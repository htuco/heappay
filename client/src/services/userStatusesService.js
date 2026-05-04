import api, { getApiErrorMessage } from '../utils/api'
import { USER_STATUS_API_ERROR_CODES } from '../types/userStatus'

const ERROR_MESSAGE_BY_DETAIL = {
  'Status name cannot be empty.': USER_STATUS_API_ERROR_CODES.VALIDATION_ERROR,
  'User status not found.': USER_STATUS_API_ERROR_CODES.NOT_FOUND,
  'User status with this name already exists.':
    USER_STATUS_API_ERROR_CODES.DUPLICATE_STATUS_NAME,
  'User status is assigned to existing users and cannot be deleted.':
    USER_STATUS_API_ERROR_CODES.IN_USE,
}

/**
 * @param {unknown} rawError
 * @returns {import('../types/userStatus').UserStatusServiceError}
 */
function mapUserStatusApiError(rawError) {
  const error = /** @type {{ response?: { status?: number, data?: { detail?: unknown } }, message?: string }} */ (
    rawError
  )
  const status = error?.response?.status
  const data = error?.response?.data
  const detail = data?.detail ?? data?.details
  const detailText =
    typeof data?.message === 'string'
      ? data.message
      : typeof data?.detail === 'string'
        ? data.detail
        : ''

  if (detailText && ERROR_MESSAGE_BY_DETAIL[detailText]) {
    return {
      code: ERROR_MESSAGE_BY_DETAIL[detailText],
      status,
      message: detailText,
      details: detail,
    }
  }

  if (status === 400 || status === 422) {
    return {
      code: USER_STATUS_API_ERROR_CODES.VALIDATION_ERROR,
      status,
      message: getApiErrorMessage(error, 'Validation failed'),
      details: detail,
    }
  }

  if (status === 404) {
    return {
      code: USER_STATUS_API_ERROR_CODES.NOT_FOUND,
      status,
      message: getApiErrorMessage(error, 'User status not found'),
      details: detail,
    }
  }

  if (status === 409) {
    return {
      code: USER_STATUS_API_ERROR_CODES.UNKNOWN_ERROR,
      status,
      message: getApiErrorMessage(error, 'User status conflict'),
      details: detail,
    }
  }

  if (!error?.response) {
    return {
      code: USER_STATUS_API_ERROR_CODES.NETWORK_ERROR,
      message: getApiErrorMessage(error, 'Network error'),
    }
  }

  return {
    code: USER_STATUS_API_ERROR_CODES.UNKNOWN_ERROR,
    status,
    message: getApiErrorMessage(error, 'User status request failed'),
    details: detail,
  }
}

export const userStatusesService = {
  /**
   * @returns {Promise<import('../types/userStatus').UserStatus[]>}
   */
  async list() {
    try {
      const response = await api.get('/user-statuses')
      return response.data
    } catch (error) {
      throw mapUserStatusApiError(error)
    }
  },

  /**
   * @param {number} statusId
   * @returns {Promise<import('../types/userStatus').UserStatus>}
   */
  async getById(statusId) {
    try {
      const response = await api.get(`/user-statuses/${statusId}`)
      return response.data
    } catch (error) {
      throw mapUserStatusApiError(error)
    }
  },

  /**
   * @param {import('../types/userStatus').CreateUserStatusPayload} payload
   * @returns {Promise<import('../types/userStatus').UserStatus>}
   */
  async create(payload) {
    try {
      const response = await api.post('/user-statuses', payload)
      return response.data
    } catch (error) {
      throw mapUserStatusApiError(error)
    }
  },

  /**
   * @param {number} statusId
   * @param {import('../types/userStatus').UpdateUserStatusPayload} payload
   * @returns {Promise<import('../types/userStatus').UserStatus>}
   */
  async update(statusId, payload) {
    try {
      const response = await api.patch(`/user-statuses/${statusId}`, payload)
      return response.data
    } catch (error) {
      throw mapUserStatusApiError(error)
    }
  },

  /**
   * @param {number} statusId
   * @returns {Promise<import('../types/userStatus').DeleteUserStatusResponse>}
   */
  async delete(statusId) {
    try {
      const response = await api.delete(`/user-statuses/${statusId}`)
      return response.data
    } catch (error) {
      throw mapUserStatusApiError(error)
    }
  },
}

export default userStatusesService
