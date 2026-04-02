import {
  formatBrandLabel,
  formatExpiryDate,
  getBrandTheme,
  maskCardNumber,
} from './paymentCard.utils'
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
    'relative w-full max-w-[430px] rounded-3xl p-6 text-white shadow-xl',
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
      style={{ background: theme.background }}
      aria-disabled={isDisabled}
      onClick={cardAction}
    >
      <div className="flex min-h-[220px] flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[0.68rem] uppercase tracking-[0.2em] text-white/75">
              Payment Card
            </p>
            <p className="text-sm font-semibold tracking-wide text-white/90">
              {formatBrandLabel(brand)}
            </p>
          </div>
          <div className="rounded-lg border border-white/30 bg-white/15 px-2 py-1 text-xs font-bold uppercase tracking-[0.18em]">
            <PaymentCardBrandIndicator brand={brand} />
          </div>
        </div>

        <div className="space-y-3">
          <p
            className="text-lg font-semibold tracking-[0.18em] sm:text-xl md:text-2xl"
            style={{ color: theme.accent }}
          >
            {maskCardNumber(cardNumber)}
          </p>

          <div className="grid grid-cols-2 items-end gap-4 text-white/95">
            <div className="min-w-0">
              <p className="text-[0.63rem] uppercase tracking-[0.16em] text-white/70">
                Card holder
              </p>
              <p className="truncate text-sm font-semibold sm:text-[0.95rem] md:text-base">
                {cardHolderName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[0.63rem] uppercase tracking-[0.16em] text-white/70">
                Expiry
              </p>
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
