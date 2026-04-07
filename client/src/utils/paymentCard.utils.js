import { BRAND_THEMES } from '@/components/payment-card/paymentCard.themes'

export function formatBrandLabel(brand) {
  const value = String(brand ?? '').trim()
  if (!value) return 'Card'
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export function normalizeBrand(brand) {
  return String(brand ?? '').trim().toLowerCase()
}

export function getBrandTheme(brand) {
  return BRAND_THEMES[normalizeBrand(brand)] || BRAND_THEMES.default
}

function getLast4(cardNumber) {
  return String(cardNumber ?? '').replace(/\D/g, '').slice(-4).padStart(4, '0')
}

export function maskCardNumber(cardNumber) {
  return `**** **** **** ${getLast4(cardNumber)}`
}

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
