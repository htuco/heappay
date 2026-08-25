export const USER_API_ERROR_CODES = Object.freeze({
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  INVALID_USER_ROLE: 'INVALID_USER_ROLE',
  INVALID_USER_STATUS: 'INVALID_USER_STATUS',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
})

/**
 * @typedef {number} UserId
 */

/**
 * @typedef {keyof typeof USER_API_ERROR_CODES} UserApiErrorCode
 */

/**
 * @typedef {Object} User
 * @property {UserId} user_id
 * @property {string} email
 * @property {string} first_name
 * @property {string} last_name
 * @property {string | null} address
 * @property {number} status_id
 * @property {number} user_role_id
 * @property {string} created_at
 * @property {string} modified_at
 * @property {string | null} deleted_at
 * @property {string | null} [last_login_at] null when the account has never signed in
 * @property {string | null} [total_spent] completed outbound spend; staff-only reads
 */

/**
 * @typedef {Object} ListUsersParams
 * @property {string=} email
 * @property {number=} statusId
 * @property {number=} userRoleId
 * @property {boolean=} includeDeleted
 * @property {number=} limit
 * @property {number=} offset
 */

/**
 * @typedef {Object} CreateUserPayload
 * @property {string} email
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} password
 * @property {string | null=} address
 * @property {number} status_id
 * @property {number} user_role_id
 */

/**
 * @typedef {Object} UpdateUserPayload
 * @property {string=} email
 * @property {string=} first_name
 * @property {string=} last_name
 * @property {string=} password
 * @property {string | null=} address
 * @property {number=} status_id
 * @property {number=} user_role_id
 */

/**
 * @typedef {Object} UserServiceError
 * @property {UserApiErrorCode | string} code
 * @property {string} message
 * @property {number=} status
 * @property {unknown=} details
 */
