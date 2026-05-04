export const USER_ROLE_API_ERROR_CODES = Object.freeze({
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  IN_USE: 'IN_USE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
})

/**
 * @typedef {number} UserRoleId
 */

/**
 * @typedef {keyof typeof USER_ROLE_API_ERROR_CODES} UserRoleApiErrorCode
 */

/**
 * Matches backend `UserRoleResponse`.
 * @typedef {Object} UserRole
 * @property {UserRoleId} role_id
 * @property {string} role_name
 */

/**
 * @typedef {Object} CreateUserRolePayload
 * @property {string} role_name
 */

/**
 * @typedef {Object} UpdateUserRolePayload
 * @property {string} role_name
 */

/**
 * @typedef {Object} UserRoleServiceError
 * @property {UserRoleApiErrorCode | string} code
 * @property {string} message
 * @property {number=} status
 * @property {unknown=} details
 */
