import { Wallet } from 'lucide-react'

import AddCardModal from '@/components/AddCardModal'
import AllCardsModal from '@/components/wallet/AllCardsModal'

export default function WalletHero({ cards, onAddCard, isSaving = false, saveError = null }) {
  return (
    <header className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          <Wallet className="h-3.5 w-3.5" />
          Wallet
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-card-foreground sm:text-4xl">
            Manage your payment cards
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            This page reuses the existing card components already in the project
            so you can preview cards in both carousel and grid layouts.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <AllCardsModal items={cards} />
        <AddCardModal onSubmit={onAddCard} isSubmitting={isSaving} submitError={saveError} />
      </div>
    </header>
  )
}
