import { useState } from 'react'
import { Plus } from 'lucide-react'

import RecurringPaymentList from '@/components/payment/RecurringPaymentList'
import RecurringPaymentWizard from '@/components/payment/RecurringPaymentWizard'
import RecurringSummaryCards from '@/components/recurring/RecurringSummaryCards'
import { Button } from '@/components/ui/button'
import useRecurringPayments from '@/hooks/useRecurringPayments'

/**
 * Standalone home for recurring payments. The page owns the fetch (via
 * `useRecurringPayments`) so the summary tiles and the list read from one
 * payload, plus the create wizard and the primary action — that keeps the
 * "New recurring payment" button in the page header where it stays visible
 * while the list below is still loading. The list keeps its own edit/cancel
 * dialog state.
 */
export default function RecurringPaymentsPage() {
  const recurring = useRecurringPayments()
  const [createOpen, setCreateOpen] = useState(false)

  function openCreate() {
    recurring.clearMutationError()
    setCreateOpen(true)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          New recurring payment
        </Button>
      </div>

      <RecurringSummaryCards rules={recurring.rules} isLoading={recurring.isLoading} />
      <RecurringPaymentList recurring={recurring} onCreate={openCreate} />

      {/* Mounted only while open so each run starts from a clean slate. */}
      {createOpen && (
        <RecurringPaymentWizard
          isOpen
          onClose={() => setCreateOpen(false)}
          cards={recurring.cards}
          currentUserId={recurring.currentUserId}
          onSubmit={recurring.createRule}
          isSubmitting={recurring.isMutating}
          error={recurring.mutationError}
          clearError={recurring.clearMutationError}
        />
      )}
    </div>
  )
}
