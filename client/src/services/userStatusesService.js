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
 * @returns {import('../types/userStatus').UserStatusServiceError}
 */
function mapUserStatusApiError(rawError) {
  const error = /** @type {{ response?: { status?: number, data?: unknown }, message?: string }} */ (
    rawError
  )
  const status = error?.response?.status
  const data = error?.response?.data
  const msg = httpErrorText(error?.response)

  if (msg && ERROR_MESSAGE_BY_DETAIL[msg]) {
    return {
      code: ERROR_MESSAGE_BY_DETAIL[msg],
      status,
      message: msg,
      details: data,
    }
  }

  if (status === 400 || status === 422) {
    return {
      code: USER_STATUS_API_ERROR_CODES.VALIDATION_ERROR,
      status,
      message: msg || getApiErrorMessage(error, 'Validation failed'),
      details: data,
    }
  }

  if (status === 404) {
    return {
      code: USER_STATUS_API_ERROR_CODES.NOT_FOUND,
      status,
      message: msg || 'User status not found.',
      details: data,
    }
  }

  if (status === 409) {
    if (msg.includes('already exists')) {
      return {
        code: USER_STATUS_API_ERROR_CODES.DUPLICATE_STATUS_NAME,
        status,
        message: msg || 'A user status with this name already exists.',
        details: data,
      }
    }
    if (msg.includes('assigned')) {
      return {
        code: USER_STATUS_API_ERROR_CODES.IN_USE,
        status,
        message: msg || 'User status is in use.',
        details: data,
      }
    }
    return {
      code: USER_STATUS_API_ERROR_CODES.UNKNOWN_ERROR,
      status,
      message: msg || getApiErrorMessage(error, 'User status conflict'),
      details: data,
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
    details: data,
  }
}

export const userStatusesService = {
  /**
   * GET /user-statuses — no query parameters.
   * @returns {Promise<import('../types/userStatus').UserStatus[]>}
   */
  async list() {
    try {
      const { data } = await api.get('/user-statuses')
      return data
    } catch (error) {
      throw mapUserStatusApiError(error)
    }
  },

  /**
   * GET /user-statuses/{statusId}
   * @param {number} statusId
   * @returns {Promise<import('../types/userStatus').UserStatus>}
   */
  async getById(statusId) {
    try {
      const { data } = await api.get(`/user-statuses/${statusId}`)
      return data
    } catch (error) {
      throw mapUserStatusApiError(error)
    }
  },

  /**
   * POST /user-statuses
   * @param {import('../types/userStatus').CreateUserStatusPayload} payload
   * @returns {Promise<import('../types/userStatus').UserStatus>}
   */
  async create(payload) {
    try {
      const { data } = await api.post('/user-statuses', {
        status_name: payload.status_name,
      })
      return data
    } catch (error) {
      throw mapUserStatusApiError(error)
    }
  },

  /**
   * PATCH /user-statuses/{statusId}
   * @param {number} statusId
   * @param {import('../types/userStatus').UpdateUserStatusPayload} payload
   * @returns {Promise<import('../types/userStatus').UserStatus>}
   */
  async update(statusId, payload) {
    try {
      const { data } = await api.patch(`/user-statuses/${statusId}`, {
        status_name: payload.status_name,
      })
      return data
    } catch (error) {
      throw mapUserStatusApiError(error)
    }
  },

  /**
   * DELETE /user-statuses/{statusId}
   * @param {number} statusId
   * @returns {Promise<import('../types/userStatus').DeleteUserStatusResponse>}
   */
  async delete(statusId) {
    try {
      const { data } = await api.delete(`/user-statuses/${statusId}`)
      return data
    } catch (error) {
      throw mapUserStatusApiError(error)
    }
  },
}

export default userStatusesService
