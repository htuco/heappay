import { CARD_BRANDS, detectCardBrand, normalizeBrand } from '@/utils/paymentCard.utils'

const MASK_CHAR = '*'
const VISIBLE_TAIL = 4

function getBrandByKey(brandKey) {
  if (!brandKey) return null
  const key = normalizeBrand(brandKey)
  return CARD_BRANDS.find((b) => b.key === key) ?? null
}

function pickLengthForDigits(brand, digitCount) {
  if (!brand) return digitCount || 16
  const lengths = brand.lengths
  if (!Array.isArray(lengths) || lengths.length === 0) return digitCount || 16
  if (digitCount && lengths.includes(digitCount)) return digitCount
  return Math.max(...lengths)
}

function buildMaskedDigits(totalLength, visibleTail, lastDigits) {
  const tailDigits = String(lastDigits ?? '').replace(/\D/g, '').slice(-visibleTail)
  const tailLength = tailDigits.length
  const maskLength = Math.max(totalLength - tailLength, 0)
  return MASK_CHAR.repeat(maskLength) + tailDigits
}

function applyGaps(digitsLikeString, gaps) {
  const groups = []
  let cursor = 0
  const breaks = Array.isArray(gaps) ? gaps : []
  breaks.forEach((breakAt) => {
    if (digitsLikeString.length > cursor) {
      groups.push(digitsLikeString.slice(cursor, breakAt))
    }
    cursor = breakAt
  })
  if (digitsLikeString.length > cursor) {
    groups.push(digitsLikeString.slice(cursor))
  }
  return groups.filter(Boolean).join(' ')
}

/**
 * maskCardNumber — produces a brand-aware masked display string.
 *
 * Examples:
 *   maskCardNumber('378282246310005')               -> '**** ****** *0005'      (Amex, 15)
 *   maskCardNumber('4111111111111234')              -> '**** **** **** 1234'    (Visa, 16)
 *   maskCardNumber({ last_four: '1234', brand: 'visa' })  -> '**** **** **** 1234'
 *   maskCardNumber({ last_four: '0005', brand: 'amex' })  -> '**** ****** *0005'
 *
 * Accepts either a raw card number / formatted card number string, or an object
 * with `{ last_four, brand }` / `{ cardNumber, brand }` so callers don't need
 * to remember the exact field names used by the backend.
 */
export function maskCardNumber(input, options = {}) {
  if (input && typeof input === 'object') {
    const obj = input
    const brandHint =
      options.brand ?? obj.brand ?? obj.cardBrand ?? obj.card_brand ?? obj.type ?? obj.cardType ?? null
    const last4 =
      obj.last_four ??
      obj.lastFour ??
      obj.last4 ??
      obj.cardNumber ??
      obj.card_number ??
      obj.maskedCardNumber ??
      obj.masked_card_number ??
      ''
    return maskCardNumber(last4, { ...options, brand: brandHint })
  }

  const raw = String(input ?? '').replace(/\D/g, '')
  const brandHint = options.brand ?? null
  const brand = getBrandByKey(brandHint) ?? detectCardBrand(raw)
  const totalLength = pickLengthForDigits(brand, raw.length)
  const gaps = brand?.gaps ?? [4, 8, 12]
  const visibleTail = options.visibleTail ?? VISIBLE_TAIL

  const masked = buildMaskedDigits(totalLength, visibleTail, raw)
  return applyGaps(masked, gaps)
}

/**
 * Returns the last N digits of a card number, padded with zeros if shorter.
 * Convenient when callers already have a last_four but want a consistent shape.
 */
export function getCardTail(cardNumberOrLast4, length = VISIBLE_TAIL) {
  const digits = String(cardNumberOrLast4 ?? '').replace(/\D/g, '').slice(-length)
  return digits.padStart(length, '0')
}
