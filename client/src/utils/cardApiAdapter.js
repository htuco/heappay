import { maskCardNumber } from '@/utils/cardMask'

const DISABLED_STATUSES = new Set(['frozen', 'expired', 'cancelled'])
const ACTIVE_STATUS_NAME = 'active'
const DEFAULT_CARD_TYPE_NAME = 'debit'

// Maps frontend brand keys (from paymentCard.utils CARD_BRANDS) to DB vendor values.
const BRAND_KEY_TO_DB_VENDOR = {
  amex: 'american-express',
}

function normalizeLookupName(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function buildLookupById(rows, idKey) {
  return Object.fromEntries(rows.map((row) => [row[idKey], row]))
}

export function getUserDisplayName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
}

export function normalizeApiCard(card, typesById, statusesById, holderName) {
  const statusName = normalizeLookupName(statusesById[card.status_id]?.status_name)
  const vendor = normalizeLookupName(typesById[card.card_type_id]?.vendor)
  const brand = vendor || 'unknown'

  return {
    id: String(card.card_id),
    source: card,
    balance: card.balance ?? '0.00',
    isMain: card.is_main ?? false,
    card: {
      cardHolderName: card.cardholder_name || holderName || 'Card holder',
      cardNumber: maskCardNumber(card.masked_card_number, { brand }),
      expiryDate: card.expires_at,
      brand,
      isActive: statusName === ACTIVE_STATUS_NAME,
      isDisabled: DISABLED_STATUSES.has(statusName),
      status: statusName || 'unknown',
    },
  }
}

export function normalizeApiCards(rawCards, cardTypes, cardStatuses, holderName) {
  const typesById = buildLookupById(cardTypes, 'card_type_id')
  const statusesById = buildLookupById(cardStatuses, 'card_status_id')

  return rawCards.map((card) =>
    normalizeApiCard(card, typesById, statusesById, holderName)
  )
}

export function findCardStatusId(cardStatuses, statusName) {
  return cardStatuses.find(
    (status) => normalizeLookupName(status.status_name) === normalizeLookupName(statusName)
  )?.card_status_id
}

export function findCardTypeId(cardTypes, vendor, typeName = DEFAULT_CARD_TYPE_NAME) {
  const normalizedVendor = normalizeLookupName(vendor)
  const normalizedTypeName = normalizeLookupName(typeName)

  return cardTypes.find(
    (cardType) =>
      normalizeLookupName(cardType.vendor) === normalizedVendor &&
      normalizeLookupName(cardType.type_name) === normalizedTypeName
  )?.card_type_id
}

export function expiryInputToApiDate(expiry) {
  const match = String(expiry ?? '').match(/^(\d{2})\/(\d{2})$/)
  if (!match) return ''

  const month = Number(match[1])
  if (month < 1 || month > 12) return ''

  const year = 2000 + Number(match[2])
  const lastDay = new Date(year, month, 0).getDate()

  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

export function buildCreateCardPayload({ cardInput, userId, cardTypes, cardStatuses }) {
  const statusId = findCardStatusId(cardStatuses, ACTIVE_STATUS_NAME)
  const dbVendor = BRAND_KEY_TO_DB_VENDOR[cardInput.type] ?? cardInput.type
  const typeName = cardInput.cardType || DEFAULT_CARD_TYPE_NAME
  const cardTypeId = findCardTypeId(cardTypes, dbVendor, typeName)

  if (!statusId) {
    throw new Error('Active card status is unavailable.')
  }

  if (!cardTypeId) {
    throw new Error(`${cardInput.type} ${typeName} cards are unavailable.`)
  }

  return {
    user_id: userId,
    status_id: statusId,
    card_type_id: cardTypeId,
    card_numb: cardInput.number.replace(/\D/g, ''),
    cvc: cardInput.cvv,
    expires_at: expiryInputToApiDate(cardInput.expiry),
    cardholder_name: cardInput.name?.trim() || null,
  }
}
