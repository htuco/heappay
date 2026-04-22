import { useState } from 'react'

import CardCollectionView from '@/components/card-view/CardCollectionView'
import CardStatusOverview from '@/components/dashboard/CardStatusOverview'
import WalletHero from '@/components/wallet/WalletHero'
import {
  buildCardStatusOverviewProps,
  paymentCardMockData,
} from '@/mock-data/paymentCardMockData'

export default function WalletPage() {
  const [cards, setCards] = useState(paymentCardMockData)

  function handleAddCard(cardInput) {
    const nextCard = {
      id: `card-${crypto.randomUUID()}`,
      card: {
        cardHolderName: cardInput.name,
        cardNumber: cardInput.number,
        expiryDate: cardInput.expiry,
        brand: cardInput.type.toLowerCase(),
        isActive: false,
        isDisabled: false,
      },
    }

    setCards((currentCards) => [...currentCards, nextCard])
  }

  return (
    <div className="space-y-6">
      <WalletHero cards={cards} onAddCard={handleAddCard} />
      <CardStatusOverview {...buildCardStatusOverviewProps(cards)} />
      <CardCollectionView variant="carousel" items={cards} />
    </div>
  )
}
