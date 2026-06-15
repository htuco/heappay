import { createElement, useState } from 'react'
import { CreditCard, HelpCircle, Plus, SlidersHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import AddCardModal from '@/components/AddCardModal'

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

function ActionTile({ icon, title, subtitle, onClick, disabled }) {
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title="Coming soon"
        className={`${TILE_BASE} cursor-not-allowed select-none opacity-50`}
      >
        <TileBody icon={icon} title={title} subtitle={subtitle} />
      </button>
    )
  }

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

/**
 * Wallet-specific quick actions, shown under the Available Balance panel.
 * Add Card opens the shared AddCardModal (controlled here); Transfer routes to
 * the payments page. Card Limits and Help Center are not implemented yet and
 * render as disabled "coming soon" controls.
 */
export default function WalletQuickActions({ onAddCard, isAddingCard = false, addCardError = null }) {
  const navigate = useNavigate()
  const [addCardOpen, setAddCardOpen] = useState(false)

  return (
    <section className="rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 text-base font-semibold text-card-foreground sm:text-lg">Quick Actions</h2>

      <div className="grid grid-cols-2 gap-2.5">
        <ActionTile
          icon={Plus}
          title="Add Card"
          subtitle="Add a new card"
          onClick={() => setAddCardOpen(true)}
        />
        <ActionTile
          icon={CreditCard}
          title="Transfer"
          subtitle="Send money"
          onClick={() => navigate('/payments')}
        />
        <ActionTile icon={SlidersHorizontal} title="Card Limits" subtitle="Manage limits" disabled />
        <ActionTile icon={HelpCircle} title="Help Center" subtitle="Get support" disabled />
      </div>

      <AddCardModal
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        onSubmit={onAddCard}
        isSubmitting={isAddingCard}
        submitError={addCardError}
      />
    </section>
  )
}
