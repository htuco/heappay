export const CARD_BRANDS = [
  {
    key: 'visa-electron',
    label: 'Visa Electron',
    patterns: [/^4026/, /^417500/, /^4405/, /^4508/, /^4844/, /^4913/, /^4917/],
    lengths: [16],
    gaps: [4, 8, 12],
    cvvLength: 3,
  },
  {
    key: 'visa',
    label: 'Visa',
    patterns: [/^4/],
    lengths: [16, 18, 19],
    gaps: [4, 8, 12],
    cvvLength: 3,
  },
  {
    key: 'amex',
    label: 'American Express',
    patterns: [/^3[47]/],
    lengths: [15],
    gaps: [4, 10],
    cvvLength: 4,
  },
  {
    key: 'mastercard',
    label: 'Mastercard',
    patterns: [/^5[1-5]/, /^2(2[2-9][1-9]|[3-6]\d{2}|7[01]\d|720)/],
    lengths: [16],
    gaps: [4, 8, 12],
    cvvLength: 3,
  },
  {
    key: 'discover',
    label: 'Discover',
    patterns: [/^6011/, /^64[4-9]/, /^65/],
    lengths: [16, 19],
    gaps: [4, 8, 12],
    cvvLength: 3,
  },
  {
    key: 'diners-club',
    label: 'Diners Club',
    patterns: [/^30[0-5]/, /^36/, /^38/, /^39/],
    lengths: [14, 16, 19],
    gaps: [4, 10],
    cvvLength: 3,
  },
  {
    key: 'jcb',
    label: 'JCB',
    patterns: [/^2131/, /^1800/, /^35(2[8-9]|[3-8]\d)/],
    lengths: [16, 17, 18, 19],
    gaps: [4, 8, 12],
    cvvLength: 3,
  },
  {
    key: 'unionpay',
    label: 'UnionPay',
    patterns: [/^62/, /^81/],
    lengths: [14, 15, 16, 17, 18, 19],
    gaps: [4, 8, 12],
    cvvLength: 3,
  },
  {
    key: 'maestro',
    label: 'Maestro',
    patterns: [/^493698/, /^5(0[0-9]|[6-9])/, /^6[37]/],
    lengths: [12, 13, 14, 15, 16, 17, 18, 19],
    gaps: [4, 8, 12],
    cvvLength: 3,
  },
  {
    key: 'elo',
    label: 'Elo',
    patterns: [/^40117[89]/, /^431274/, /^438935/, /^451416/, /^45763[12]/, /^504175/, /^50(6[7-9]|9)/, /^650/, /^6516/, /^6550/],
    lengths: [16],
    gaps: [4, 8, 12],
    cvvLength: 3,
  },
  {
    key: 'hipercard',
    label: 'Hipercard',
    patterns: [/^606282/, /^637(095|568)/],
    lengths: [16],
    gaps: [4, 8, 12],
    cvvLength: 3,
  },
]

const BRAND_ALIASES = {
  'american express': 'amex',
  'american-express': 'amex',
  'master card': 'mastercard',
  'mastercard': 'mastercard',
  'diners': 'diners-club',
}

export function normalizeBrand(brand) {
  const value = String(brand ?? '').trim().toLowerCase()
  return BRAND_ALIASES[value] ?? value
}

export function detectCardBrand(cardNumber) {
  const digits = String(cardNumber ?? '').replace(/\D/g, '')
  if (!digits) return null
  return CARD_BRANDS.find((brand) => brand.patterns.some((p) => p.test(digits))) ?? null
}

export function formatBrandLabel(brand) {
  const normalized = normalizeBrand(brand)
  if (!normalized) return 'Card'
  const found = CARD_BRANDS.find((b) => b.key === normalized)
  if (found) return found.label
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function getMaxCardLength(brand) {
  return Math.max(...(brand?.lengths ?? [19]))
}

export function formatCardNumber(value, brand) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, getMaxCardLength(brand))
  const gaps = brand?.gaps ?? [4, 8, 12]
  const parts = []
  let start = 0
  gaps.forEach((gap) => {
    if (digits.length > start) parts.push(digits.slice(start, gap))
    start = gap
  })
  if (digits.length > start) parts.push(digits.slice(start))
  return parts.filter(Boolean).join(' ')
}

export function formattedMaxLength(brand) {
  return formatCardNumber('9'.repeat(getMaxCardLength(brand)), brand).length
}

export function passesLuhn(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return false
  let sum = 0
  let shouldDouble = false
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i])
    if (shouldDouble) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

export { maskCardNumber } from '@/utils/cardMask'

export function formatExpiryDate(expiryDate) {
  const value = String(expiryDate ?? '').trim()
  if (!value) return '--/--'
  if (/^\d{2}\/\d{2}$/.test(value)) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-')
    return `${month}/${year.slice(-2)}`
  }
  return value
}
