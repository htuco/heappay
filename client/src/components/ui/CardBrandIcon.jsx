import { PaymentIcon } from 'react-svg-credit-card-payment-icons'

const ALIAS = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  master: 'Mastercard',
  'master-card': 'Mastercard',
  amex: 'Amex',
  'american-express': 'Amex',
  'american express': 'Amex',
  discover: 'Discover',
  diners: 'DinersClub',
  'diners-club': 'DinersClub',
  dinersclub: 'DinersClub',
  jcb: 'JCB',
  maestro: 'Maestro',
  unionpay: 'UnionPay',
  'union-pay': 'UnionPay',
  elo: 'Elo',
  hipercard: 'Hipercard',
  hiper: 'Hiper',
  mir: 'Mir',
  paypal: 'PayPal',
  alipay: 'Alipay',
  swish: 'Swish',
}

function detect(cardNumber) {
  if (!cardNumber) return null
  const digits = String(cardNumber).replace(/\D/g, '')
  if (/^4/.test(digits)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard'
  if (/^3[47]/.test(digits)) return 'Amex'
  if (/^6(011|5|4[4-9])/.test(digits)) return 'Discover'
  return null
}

export function CardBrandIcon({ cardNumber, brand, width = 44, format = 'flatRounded' }) {
  const type = (brand && ALIAS[brand.toLowerCase().trim()]) ?? detect(cardNumber) ?? 'Generic'
  return <PaymentIcon type={type} format={format} width={width} />
}

export default CardBrandIcon
