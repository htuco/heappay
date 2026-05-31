import { useState } from 'react'

import AddCardModal from '@/components/AddCardModal'
import CardCarousel from '@/components/card-view/CardCarousel'
import AllCardsModal from '@/components/wallet/AllCardsModal'
import BalancePanel from '@/components/wallet/BalancePanel'
import CardStatsRow from '@/components/wallet/CardStatsRow'
import RecentTransactionsByCard from '@/components/wallet/RecentTransactionsByCard'
import WalletSection from '@/components/wallet/WalletSection'
import { useWalletCards } from '@/hooks/useWalletCards'
import { buildCardStatusOverviewProps } from '@/utils/cardStatusOverview'

const PRIMARY_CTA_CLASS =
  'h-12 w-full justify-center gap-2 rounded-surface bg-white text-base font-semibold text-primary shadow-lg transition hover:-translate-y-0.5 hover:bg-white hover:text-primary hover:shadow-xl'

const SECONDARY_CTA_CLASS =
  'h-11 w-full justify-center gap-2 rounded-surface border border-white/30 bg-white/10 text-sm font-medium text-primary-foreground backdrop-blur transition hover:bg-white/20 hover:text-primary-foreground'

export default function WalletPage() {
  const { cards, isLoading, isSaving, error, saveError, addCard, setMainCard, removeCard } = useWalletCards()
  const [activeIndex, setActiveIndex] = useState(0)

  const safeIndex = cards.length > 0 ? Math.min(activeIndex, cards.length - 1) : 0
  const activeCard = cards[safeIndex]

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-panel border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive shadow-sm"
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <WalletSection className="h-full">
            {cards.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center gap-3 rounded-surface bg-muted/30 p-12 text-center">
                <p className="text-base font-semibold text-card-foreground">
                  No payment cards yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Add your first card to get started.
                </p>
              </div>
            ) : (
              <CardCarousel
                items={cards}
                activeIndex={safeIndex}
                onChangeIndex={setActiveIndex}
              />
            )}
          </WalletSection>
        </div>
        <div className="lg:col-span-4">
          <div className="h-full">
            <BalancePanel
              activeCard={activeCard}
              isLoading={isLoading}
              addCardSlot={
                <AddCardModal
                  onSubmit={addCard}
                  isSubmitting={isSaving}
                  submitError={saveError}
                  triggerLabel="Add Card"
                  triggerClassName={PRIMARY_CTA_CLASS}
                  triggerVariant="ghost"
                />
              }
              manageCardsSlot={
                <AllCardsModal
                  items={cards}
                  triggerLabel="Manage Cards"
                  triggerClassName={SECONDARY_CTA_CLASS}
                  triggerVariant="ghost"
                  onSetMain={setMainCard}
                  onRemove={removeCard}
                  addCardSlot={
                    <AddCardModal
                      onSubmit={addCard}
                      isSubmitting={isSaving}
                      submitError={saveError}
                      triggerLabel="Add new card"
                      triggerVariant="default"
                    />
                  }
                />
              }
            />
          </div>
        </div>
      </div>

      <CardStatsRow {...buildCardStatusOverviewProps(cards)} />

      <RecentTransactionsByCard
        cards={cards}
        activeCardId={activeCard?.id}
        isLoading={isLoading}
      />
    </div>
  )
}
