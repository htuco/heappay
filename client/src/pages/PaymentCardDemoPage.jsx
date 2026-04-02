import PaymentCard from '@/components/payment-card/PaymentCard'
import { paymentCardMockData } from '@/components/payment-card/paymentCardMockData'

export default function PaymentCardDemoPage() {
  return (
    <section className="space-y-6 p-3 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Payment Card Component Demo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Temporary preview page for the reusable payment card UI with brand-based
          colors and state variants.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {paymentCardMockData.map((entry) => (
          <div key={entry.id} className="w-full max-w-[430px]">
            <PaymentCard card={entry.card} />
          </div>
        ))}
      </div>
    </section>
  )
}
