import CardCollectionView from '@/components/card-view/CardCollectionView'
import CardStatusOverview from '@/components/dashboard/CardStatusOverview'
import WalletHero from '@/components/wallet/WalletHero'
import { useWalletCards } from '@/hooks/useWalletCards'
import { buildCardStatusOverviewProps } from '@/utils/cardStatusOverview'

export default function WalletPage() {
  const { cards, isLoading, isSaving, error, saveError, addCard } = useWalletCards()

  return (
    <div className="space-y-6">
      <WalletHero
        cards={cards}
        onAddCard={addCard}
        isSaving={isSaving}
        saveError={saveError}
      />
      {error ? (
        <div
          role="alert"
          className="rounded-3xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive shadow-sm"
        >
          {error}
        </div>
      ) : null}
      {isLoading ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Loading cards...
        </div>
      ) : null}
      <CardStatusOverview {...buildCardStatusOverviewProps(cards)} />
      <CardCollectionView variant="carousel" items={cards} />
    </div>
  )
}
