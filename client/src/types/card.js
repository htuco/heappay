export class CardFkError extends Error {
  constructor(field, message) {
    super(message)
    this.name = 'CardFkError'
    this.field = field
  }
}

/**
 * Matches backend `CardResponse`.
 * @typedef {Object} Card
 * @property {number} card_id
 * @property {number} user_id
 * @property {number} status_id
 * @property {number} card_type_id
 * @property {string} last_four
 * @property {string} masked_card_number
 * @property {string} expires_at
 * @property {string} created_at
 * @property {string | null} deleted_at
 * @property {boolean} is_main
 */

/**
 * Backend card creation payload.
 * @typedef {Object} CreateCardPayload
 * @property {number} user_id
 * @property {number} status_id
 * @property {number} card_type_id
 * @property {string} card_numb
 * @property {string} cvc
 * @property {string} expires_at
 */

/**
 * Backend card patch payload.
 * @typedef {Partial<CreateCardPayload>} UpdateCardPayload
 */

/**
 * Payment card view model consumed by wallet/card components.
 * @typedef {Object} PaymentCardItem
 * @property {string} id
 * @property {Card} source
 * @property {boolean} isMain
 * @property {Object} card
 * @property {string} card.cardHolderName
 * @property {string} card.cardNumber
 * @property {string} card.expiryDate
 * @property {string} card.brand
 * @property {boolean} card.isActive
 * @property {boolean} card.isDisabled
 */
