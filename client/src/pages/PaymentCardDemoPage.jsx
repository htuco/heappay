import PaymentCard from '@/components/payment-card/PaymentCard'

export default function PaymentCardDemoPage() {
  const sampleCard = {
    cardHolderName: 'Sample User',
    cardNumber: '**** **** **** 1121',
    expiryDate: '08/30',
    brand: 'Visa',
    isActive: true,
    isDisabled: false,
  }

  return (
    <section className="space-y-6 p-3 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Payment Card Component Demo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Temporary preview page for the reusable payment card UI with brand-based
          colors and state variants.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="w-full max-w-[430px]">
          <PaymentCard card={sampleCard} />
        </div>
      </div>
    </section>
  )
}
