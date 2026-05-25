import { PaymentIcon, getCardType } from 'react-svg-credit-card-payment-icons'

const BRAND_ICON_ALIASES = {
  visa: 'Visa',
  'visa-electron': 'Visa',
  mastercard: 'Mastercard',
  master: 'Mastercard',
  'master-card': 'Mastercard',
  amex: 'AmericanExpress',
  'american-express': 'AmericanExpress',
  'american express': 'AmericanExpress',
  americanexpress: 'AmericanExpress',
  discover: 'Discover',
  diners: 'DinersClub',
  'diners-club': 'DinersClub',
  'diners club': 'DinersClub',
  dinersclub: 'DinersClub',
  jcb: 'JCB',
  maestro: 'Maestro',
  unionpay: 'UnionPay',
  'union-pay': 'UnionPay',
  'union pay': 'UnionPay',
  elo: 'Elo',
  hipercard: 'Hipercard',
  hiper: 'Hiper',
  mir: 'Mir',
  paypal: 'PayPal',
  alipay: 'Alipay',
  swish: 'Swish',
}

function resolveIconType(cardNumber, brand) {
  const normalizedBrand = String(brand ?? '').trim().toLowerCase()
  if (BRAND_ICON_ALIASES[normalizedBrand]) return BRAND_ICON_ALIASES[normalizedBrand]

  const digits = String(cardNumber ?? '').replace(/\D/g, '')
  return digits ? getCardType(digits) : 'Generic'
}

export default function CardBrandIcon({
  cardNumber,
  brand,
  width = 42,
  format = 'flatRounded',
}) {
  return (
    <PaymentIcon
      type={resolveIconType(cardNumber, brand)}
      format={format}
      width={width}
    />
  )
}
