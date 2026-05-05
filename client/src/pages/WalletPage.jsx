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
        <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
          Loading cards...
        </div>
      ) : null}
      <CardStatusOverview {...buildCardStatusOverviewProps(cards)} />
      <CardCollectionView variant="carousel" items={cards} />
    </div>
  )
}
