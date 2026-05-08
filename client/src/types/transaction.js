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
 * @typedef {Object} ListByCardParams
 * @property {number=} page
 * @property {number=} pageSize
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
 * One bucket in the money-flow summary.
 * @typedef {Object} TransactionSummaryPoint
 * @property {string} period  - "YYYY-MM" e.g. "2026-01"
 * @property {string} income  - Decimal string, total credited to user's cards
 * @property {string} expense - Decimal string, total debited from user's cards
 * @property {string} net     - Decimal string (income − expense)
 */

/**
 * @typedef {Object} TransactionSummary
 * @property {TransactionSummaryPoint[]} points - Newest month first
 * @property {number} months
 */

/**
 * @typedef {Object} GetSummaryParams
 * @property {number=} months - Lookback window in months, 1–24 (default: 6)
 */

/**
 * @typedef {Object} TransactionServiceError
 * @property {TransactionApiErrorCode | string} code
 * @property {string} message
 * @property {number=} status
 * @property {unknown=} details
 */
