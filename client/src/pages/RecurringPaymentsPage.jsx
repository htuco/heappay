import { useState } from 'react'
import { Plus } from 'lucide-react'

import RecurringPaymentList from '@/components/payment/RecurringPaymentList'
import RecurringPaymentWizard from '@/components/payment/RecurringPaymentWizard'
import RecurringSummaryCards from '@/components/recurring/RecurringSummaryCards'
import { PageActionButton, PageActionSlot } from '@/components/ui/PageAction'
import useRecurringPayments from '@/hooks/useRecurringPayments'

/**
 * Standalone home for recurring payments. The page owns the fetch (via
 * `useRecurringPayments`) so the summary tiles and the list read from one
 * payload, plus the create wizard and the primary action — the "New recurring
 * payment" button renders into the Layout top bar, so it stays visible while
 * the list below is still loading. The list keeps its own edit/cancel dialog
 * state.
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
      <PageActionSlot>
        <PageActionButton icon={Plus} label="New recurring payment" onClick={openCreate} />
      </PageActionSlot>

      <div data-tour="recurring-summary">
        <RecurringSummaryCards rules={recurring.rules} isLoading={recurring.isLoading} />
      </div>
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
