import { CreditCard } from 'lucide-react'

import AddCardModal from '@/components/AddCardModal'
import AllCardsModal from '@/components/wallet/AllCardsModal'
import WalletSection from '@/components/wallet/WalletSection'

export default function WalletHero({ cards, onAddCard, isSaving = false, saveError = null }) {
  const cardCount = cards?.length ?? 0
  const cardLabel = cardCount === 1 ? 'card' : 'cards'
  const subtitle =
    cardCount === 0 ? 'Add your first card to get started' : 'Active in your wallet'

  return (
    <WalletSection
      as="header"
      title={`${cardCount} ${cardLabel}`}
      subtitle={subtitle}
      icon={<CreditCard className="h-5 w-5" strokeWidth={2} />}
      headerClassName="!mb-0 sm:items-center"
      actions={
        <>
          <AllCardsModal items={cards} />
          <AddCardModal onSubmit={onAddCard} isSubmitting={isSaving} submitError={saveError} />
        </>
      }
    />
  )
}
