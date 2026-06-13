import { useEffect, useRef } from 'react'
import Cards from 'react-credit-cards-2'

import {
  formatExpiryDate,
  normalizeBrand,
} from '@/utils/paymentCard.utils'

// react-credit-cards-2 renders a fixed 290px-wide card that is only ever
// resized with transform: scale(). Below md the CSS reads --rccs-scale to
// fit the card to its container (see index.css).
const RCCS_BASE_WIDTH = 290
const RCCS_MAX_SCALE = 1.6

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
  const shellRef = useRef(null)

  useEffect(() => {
    const el = shellRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width
      if (!width) return
      const scale = Math.min(RCCS_MAX_SCALE, width / RCCS_BASE_WIDTH)
      el.style.setProperty('--rccs-scale', scale.toFixed(4))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
      ref={shellRef}
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
