import { createElement, useState } from 'react'
import { CreditCard, Plus } from 'lucide-react'

import AddCardModal from '@/components/AddCardModal'
import PaymentWizard from '@/components/payment/PaymentWizard'
import Skeleton from '@/components/ui/skeleton'

const TILE_BASE =
  'flex items-center gap-3 rounded-input border border-border/70 bg-background px-3 py-3 text-left transition-all duration-200 touch-manipulation'

function TileBody({ icon, title, subtitle }) {
  return (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-input bg-primary/10 text-primary">
        {createElement(icon, { className: 'size-4', strokeWidth: 2.2 })}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-card-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </>
  )
}

function ActionTile({ icon, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${TILE_BASE} hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5`}
    >
      <TileBody icon={icon} title={title} subtitle={subtitle} />
    </button>
  )
}

// Same box as ActionTile (TILE_BASE sets the border/padding/height) so swapping
// to the real tiles causes no shift.
function ActionTileSkeleton() {
  return (
    <div className={TILE_BASE}>
      <Skeleton className="size-9 shrink-0 rounded-input" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

/**
 * Wallet-specific quick actions, shown under the Available Balance panel.
 * Add Card opens the shared AddCardModal (controlled here); Transfer routes to
 * the payments page.
 */
export default function WalletQuickActions({
  onAddCard,
  isAddingCard = false,
  addCardError = null,
  onClearAddCardError,
  isLoading = false,
}) {
  const [addCardOpen, setAddCardOpen] = useState(false)
  const [paymentWizardOpen, setPaymentWizardOpen] = useState(false)

  return (
    <section className="@container/qa rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 text-base font-semibold text-card-foreground sm:text-lg">Quick Actions</h2>

      {/* 2-up only when the container is wide enough that tile labels won't
          truncate; otherwise stack (the right rail is narrow until xl). */}
      <div className="grid grid-cols-1 gap-2.5 @[360px]/qa:grid-cols-2">
        {isLoading ? (
          <>
            <ActionTileSkeleton />
            <ActionTileSkeleton />
          </>
        ) : (
          <>
            <ActionTile
              icon={Plus}
              title="Add Card"
              subtitle="Add a new card"
              onClick={() => setAddCardOpen(true)}
            />
            <ActionTile
              icon={CreditCard}
              title="Send Money"
              subtitle="Pay or transfer"
              onClick={() => setPaymentWizardOpen(true)}
            />
          </>
        )}
      </div>

      <AddCardModal
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        onSubmit={onAddCard}
        isSubmitting={isAddingCard}
        submitError={addCardError}
        onClearSubmitError={onClearAddCardError}
      />

      {/* No initialCardId — the wizard opens on the "Choose a card" step so the
          user picks the source card here. */}
      <PaymentWizard
        isOpen={paymentWizardOpen}
        onClose={() => setPaymentWizardOpen(false)}
      />
    </section>
  )
}
