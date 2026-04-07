import {
  formatBrandLabel,
  formatExpiryDate,
  getBrandTheme,
  maskCardNumber,
} from '@/utils/paymentCard.utils'
import PaymentCardBrandIndicator from './PaymentCardBrandIndicator'

export default function PaymentCard({
  card,
  className,
  onClick,
}) {
  const {
    cardHolderName = 'Unknown card holder',
    cardNumber = '',
    expiryDate = '',
    brand = 'Card',
    isActive = false,
    isDisabled = false,
  } = card || {}
  const theme = getBrandTheme(brand)
  const cardAction = isDisabled ? undefined : onClick
  const classes = [
    'payment-card-shell',
    isActive &&
      'ring-2 ring-white/80 ring-offset-2 ring-offset-background scale-[1.015]',
    isDisabled && 'opacity-55 grayscale-[0.25] saturate-[0.8]',
    cardAction && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-2xl',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article
      className={classes}
      style={{
        background: theme.background,
        boxShadow:
          '0 16px 30px rgba(16, 24, 40, 0.24), inset 0 1px 1px rgba(255,255,255,0.18)',
      }}
      aria-disabled={isDisabled}
      onClick={cardAction}
    >
      <div
        className="payment-card-overlay"
        style={{
          background:
            'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.38), transparent 45%), radial-gradient(circle at 100% 120%, rgba(255,255,255,0.16), transparent 44%)',
        }}
      />
      <div
        className="payment-card-gloss"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.38), rgba(255,255,255,0.05))',
          filter: 'blur(1.5px)',
        }}
      />

      <div className="payment-card-content">
        <div className="payment-card-header">
          <div className="space-y-1">
            <p className="text-[0.68rem] uppercase tracking-[0.2em] text-white/75">
              Payment Card
            </p>
            <p className="text-sm font-semibold tracking-wide text-white/90">
              {formatBrandLabel(brand)}
            </p>
          </div>
          <div className="payment-card-brand-chip">
            <PaymentCardBrandIndicator brand={brand} icon={theme.icon} />
          </div>
        </div>

        <div className="payment-card-bottom">
          <p className="payment-card-number" style={{ color: theme.accent }}>
            {maskCardNumber(cardNumber)}
          </p>

          <div className="payment-card-meta">
            <div className="min-w-0">
              <p className="payment-card-label">Card holder</p>
              <p className="truncate text-sm font-semibold sm:text-[0.95rem] md:text-base">
                {cardHolderName}
              </p>
            </div>
            <div className="text-right">
              <p className="payment-card-label">Expiry</p>
              <p className="text-sm font-semibold sm:text-base md:text-lg">
                {formatExpiryDate(expiryDate)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
