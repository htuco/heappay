export const USER_STATUS_API_ERROR_CODES = Object.freeze({
  DUPLICATE_STATUS_NAME: 'DUPLICATE_STATUS_NAME',
  IN_USE: 'IN_USE',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
})

/**
 * @typedef {number} UserStatusId
 */

/**
 * @typedef {keyof typeof USER_STATUS_API_ERROR_CODES} UserStatusApiErrorCode
 */

/**
 * @typedef {Object} UserStatus
 * @property {UserStatusId} id
 * @property {string} status_name
 * @property {string} created_at
 */

/**
 * @typedef {Object} CreateUserStatusPayload
 * @property {string} status_name
 */

/**
 * @typedef {Object} UpdateUserStatusPayload
 * @property {string} status_name
 */

/**
 * @typedef {Object} DeleteUserStatusResponse
 * @property {string} message
 */

/**
 * @typedef {Object} UserStatusServiceError
 * @property {UserStatusApiErrorCode | string} code
 * @property {string} message
 * @property {number=} status
 * @property {unknown=} details
 */
