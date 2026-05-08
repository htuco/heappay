export const TRANSACTION_API_ERROR_CODES = Object.freeze({
  NOT_FOUND: 'NOT_FOUND',
  CARD_NOT_FOUND: 'CARD_NOT_FOUND',
  TYPE_NOT_FOUND: 'TYPE_NOT_FOUND',
  STATUS_NOT_FOUND: 'STATUS_NOT_FOUND',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
})

/**
 * @typedef {keyof typeof TRANSACTION_API_ERROR_CODES} TransactionApiErrorCode
 */

/**
 * Matches backend `TransactionResponse`.
 * @typedef {Object} Transaction
 * @property {number} transaction_id
 * @property {number | null} sender_card_id
 * @property {number} recipient_card_id
 * @property {number} transaction_type_id
 * @property {number} status_id
 * @property {string} amount - Decimal string from the API (e.g. "100.00")
 * @property {string | null} note
 * @property {string} created_at
 */

/**
 * Paginated list of transactions as returned by the API.
 * @typedef {Object} TransactionPage
 * @property {Transaction[]} items
 * @property {number} total
 * @property {number} page
 * @property {number} page_size
 * @property {number} total_pages
 */

/**
 * @typedef {Object} ListTransactionsParams
 * @property {number=} page     - 1-based page number (default: 1)
 * @property {number=} pageSize - Items per page, 1–100 (default: 20)
 */

/**
 * Matches backend `TransactionCreate`.
 * @typedef {Object} CreateTransactionPayload
 * @property {number | null} sender_card_id   - Null for deposits / incoming transfers
 * @property {number} recipient_card_id
 * @property {number} transaction_type_id
 * @property {number | string} amount         - Positive decimal (e.g. 100.00 or "100.00")
 * @property {string | null=} note
 */

/**
 * Matches backend `TransactionPatch`.
 * @typedef {Object} PatchTransactionPayload
 * @property {number=} status_id
 * @property {string | null=} note
 */

/**
 * @typedef {Object} TransactionServiceError
 * @property {TransactionApiErrorCode | string} code
 * @property {string} message
 * @property {number=} status
 * @property {unknown=} details
 */
