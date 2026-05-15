import Cards from 'react-credit-cards-2'

import {
  formatExpiryDate,
  normalizeBrand,
} from '@/utils/paymentCard.utils'

const ISSUER_MAP = {
  amex: 'american-express',
  'diners-club': 'dinersclub',
}

function getIssuer(brand) {
  const normalized = normalizeBrand(brand)
  return ISSUER_MAP[normalized] ?? normalized ?? 'unknown'
}

function getPreviewNumber(cardNumber) {
  const digits = String(cardNumber ?? '').replace(/\D/g, '')
  if (digits.length >= 4) return `************${digits.slice(-4)}`
  return '************0000'
}

const STATUS_LABELS = {
  frozen: 'Frozen',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export default function PaymentCard({
  card,
  className,
  onClick,
}) {
  const {
    cardHolderName = 'CARD HOLDER',
    cardNumber = '',
    expiryDate = '',
    brand = 'Card',
    isActive = false,
    isDisabled = false,
    status = '',
  } = card || {}

  const cardAction = isDisabled ? undefined : onClick
  const classes = [
    'payment-card-rccs-shell max-w-full relative',
    isActive && 'is-active',
    isDisabled && 'grayscale-[0.45] saturate-[0.6]',
    cardAction && 'cursor-pointer',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const statusLabel = STATUS_LABELS[status]

  return (
    <article
      className={classes}
      aria-disabled={isDisabled}
      onClick={cardAction}
    >
      <Cards
        number={getPreviewNumber(cardNumber)}
        expiry={formatExpiryDate(expiryDate)}
        cvc=""
        name={cardHolderName}
        issuer={getIssuer(brand)}
        preview
      />
      {isDisabled && statusLabel && (
        <span className="payment-card-status-badge">
          {statusLabel}
        </span>
      )}
    </article>
  )
}
