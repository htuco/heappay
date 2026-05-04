export const CARD_TYPE_API_ERROR_CODES = Object.freeze({
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  IN_USE: 'IN_USE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
})

/**
 * @typedef {number} CardTypeId
 */

/**
 * @typedef {keyof typeof CARD_TYPE_API_ERROR_CODES} CardTypeApiErrorCode
 */

/**
 * Matches backend `CardTypeResponse`.
 * @typedef {Object} CardType
 * @property {CardTypeId} card_type_id
 * @property {string} type_name
 * @property {string} vendor
 * @property {string} created_at
 */

/**
 * @typedef {Object} CreateCardTypePayload
 * @property {string} type_name
 * @property {string} vendor
 */

/**
 * @typedef {Object} UpdateCardTypePayload
 * @property {string=} type_name
 * @property {string=} vendor
 */

/**
 * @typedef {Object} CardTypeServiceError
 * @property {CardTypeApiErrorCode | string} code
 * @property {string} message
 * @property {number=} status
 * @property {unknown=} details
 */
