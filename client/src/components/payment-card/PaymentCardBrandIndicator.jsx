import { formatBrandLabel, normalizeBrand } from './paymentCard.utils'

export default function PaymentCardBrandIndicator({ brand }) {
  const normalized = normalizeBrand(brand)

  if (normalized === 'mastercard') {
    return (
      <div className="flex items-center" aria-label="Mastercard">
        <span className="h-6 w-6 rounded-full bg-[#ea4335] opacity-95" />
        <span className="-ml-2 h-6 w-6 rounded-full bg-[#fbbc04] opacity-90" />
      </div>
    )
  }

  if (normalized === 'visa') {
    return (
      <span className="text-xs font-bold tracking-[0.18em] uppercase text-white/95">
        VISA
      </span>
    )
  }

  return (
    <span className="text-xs font-semibold tracking-[0.12em] uppercase text-white/90">
      {formatBrandLabel(brand)}
    </span>
  )
}
