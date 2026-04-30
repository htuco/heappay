import api, { getApiErrorMessage } from '../utils/api'
import { USER_API_ERROR_CODES } from '../types/user'

const ERROR_MESSAGE_BY_DETAIL = {
  'Email already exists': USER_API_ERROR_CODES.DUPLICATE_EMAIL,
  'Invalid user_role_id': USER_API_ERROR_CODES.INVALID_USER_ROLE,
  'Invalid status_id': USER_API_ERROR_CODES.INVALID_USER_STATUS,
  'User not found': USER_API_ERROR_CODES.NOT_FOUND,
}

/**
 * @param {unknown} rawError
 * @returns {import('../types/user').UserServiceError}
 */
function mapUserApiError(rawError) {
  const error = /** @type {{ response?: { status?: number, data?: { detail?: unknown } }, message?: string }} */ (
    rawError
  )
  const status = error?.response?.status
  const detail = error?.response?.data?.detail
  const detailText = typeof detail === 'string' ? detail : ''

  if (detailText && ERROR_MESSAGE_BY_DETAIL[detailText]) {
    return {
      code: ERROR_MESSAGE_BY_DETAIL[detailText],
      status,
      message: detailText,
      details: detail,
    }
  }

  if (status === 422) {
    return {
      code: USER_API_ERROR_CODES.VALIDATION_ERROR,
      status,
      message: getApiErrorMessage(error, 'Validation failed'),
      details: detail,
    }
  }

  if (!error?.response) {
    return {
      code: USER_API_ERROR_CODES.NETWORK_ERROR,
      message: getApiErrorMessage(error, 'Network error'),
    }
  }

  return {
    code: USER_API_ERROR_CODES.UNKNOWN_ERROR,
    status,
    message: getApiErrorMessage(error, 'User request failed'),
    details: detail,
  }
}

/**
 * @param {import('../types/user').ListUsersParams} [params]
 * @returns {Record<string, string | number | boolean>}
 */
function buildListUsersQuery(params = {}) {
  const query = {}

  if (params.email) query.email = params.email
  if (typeof params.statusId === 'number') query.status_id = params.statusId
  if (typeof params.userRoleId === 'number') query.user_role_id = params.userRoleId
  if (typeof params.includeDeleted === 'boolean') query.include_deleted = params.includeDeleted
  if (typeof params.limit === 'number') query.limit = params.limit
  if (typeof params.offset === 'number') query.offset = params.offset

  return query
}

export const usersService = {
  /**
   * @param {import('../types/user').ListUsersParams} [params]
   * @returns {Promise<import('../types/user').User[]>}
   */
  async list(params = {}) {
    try {
      const response = await api.get('/users', {
        params: buildListUsersQuery(params),
      })
      return response.data
    } catch (error) {
      throw mapUserApiError(error)
    }
  },

  /**
   * @param {number} userId
   * @param {{ includeDeleted?: boolean }} [options]
   * @returns {Promise<import('../types/user').User>}
   */
  async getById(userId, options) {
    try {
      const response = await api.get(`/users/${userId}`, {
        params:
          typeof options?.includeDeleted === 'boolean'
            ? { include_deleted: options.includeDeleted }
            : undefined,
      })
      return response.data
    } catch (error) {
      throw mapUserApiError(error)
    }
  },

  /**
   * @param {import('../types/user').CreateUserPayload} payload
   * @returns {Promise<import('../types/user').User>}
   */
  async create(payload) {
    try {
      const response = await api.post('/users', payload)
      return response.data
    } catch (error) {
      throw mapUserApiError(error)
    }
  },

  /**
   * @param {number} userId
   * @param {import('../types/user').UpdateUserPayload} payload
   * @returns {Promise<import('../types/user').User>}
   */
  async update(userId, payload) {
    try {
      const response = await api.patch(`/users/${userId}`, payload)
      return response.data
    } catch (error) {
      throw mapUserApiError(error)
    }
  },

  /**
   * @param {number} userId
   * @returns {Promise<void>}
   */
  async delete(userId) {
    try {
      await api.delete(`/users/${userId}`)
    } catch (error) {
      throw mapUserApiError(error)
    }
  },
}

export default usersService
