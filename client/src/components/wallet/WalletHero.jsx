import { CreditCard } from 'lucide-react'

import AddCardModal from '@/components/AddCardModal'
import AllCardsModal from '@/components/wallet/AllCardsModal'

export default function WalletHero({ cards, onAddCard, isSaving = false, saveError = null }) {
  const cardCount = cards?.length ?? 0
  const cardLabel = cardCount === 1 ? 'card' : 'cards'

  return (
    <header className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary/15 to-primary-light/15 text-primary">
          <CreditCard className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-card-foreground">
            {cardCount} {cardLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            {cardCount === 0
              ? 'Add your first card to get started'
              : 'Active in your wallet'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AllCardsModal items={cards} />
        <AddCardModal onSubmit={onAddCard} isSubmitting={isSaving} submitError={saveError} />
      </div>
    </header>
  )
}
