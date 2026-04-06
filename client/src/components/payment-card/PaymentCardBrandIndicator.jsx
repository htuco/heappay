import { formatBrandLabel } from './paymentCard.utils'

export default function PaymentCardBrandIndicator({ brand, icon }) {
  if (icon) {
    return (
      <img
        src={icon}
        alt={`${formatBrandLabel(brand)} logo`}
        className="h-6 w-auto max-w-12 object-contain"
        loading="lazy"
      />
    )
  }

  return (
    <span className="text-xs font-semibold tracking-[0.12em] uppercase text-white/90">
      {formatBrandLabel(brand)}
    </span>
  )
}
