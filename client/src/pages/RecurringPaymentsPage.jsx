import RecurringPaymentList from '@/components/payment/RecurringPaymentList'
import RecurringSummaryCards from '@/components/recurring/RecurringSummaryCards'
import useRecurringPayments from '@/hooks/useRecurringPayments'

/**
 * Standalone home for recurring payments. The page owns the fetch (via
 * `useRecurringPayments`) so the summary tiles and the list read from one
 * payload; the list keeps its own dialog state.
 */
export default function RecurringPaymentsPage() {
  const recurring = useRecurringPayments()

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <RecurringSummaryCards rules={recurring.rules} isLoading={recurring.isLoading} />
      <RecurringPaymentList recurring={recurring} />
    </div>
  )
}
