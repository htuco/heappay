export const CARD_STATUS_API_ERROR_CODES = Object.freeze({
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  IN_USE: 'IN_USE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
})

/** Backend API codes on error responses */
export const CARD_STATUS_BACKEND_CODES = Object.freeze({
  NOT_FOUND: 'CARD_STATUS_NOT_FOUND',
  DUPLICATE: 'CARD_STATUS_DUPLICATE',
  IN_USE: 'CARD_STATUS_IN_USE',
})

/**
 * @typedef {number} CardStatusId
 */

/**
 * @typedef {keyof typeof CARD_STATUS_API_ERROR_CODES} CardStatusApiErrorCode
 */

/**
 * Matches backend `CardStatusResponse`.
 * @typedef {Object} CardStatus
 * @property {CardStatusId} card_status_id
 * @property {string} status_name
 * @property {string} created_at
 */

/**
 * @typedef {Object} CreateCardStatusPayload
 * @property {string} status_name
 */

/**
 * @typedef {Object} UpdateCardStatusPayload
 * @property {string} status_name
 */

/**
 * @typedef {Object} CardStatusServiceError
 * @property {CardStatusApiErrorCode | string} code
 * @property {string} message
 * @property {number=} status
 * @property {unknown=} details
 */
