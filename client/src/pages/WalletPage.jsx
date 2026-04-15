import { useState } from 'react'

import CardCollectionView from '@/components/card-view/CardCollectionView'
import CardStatusOverview from '@/components/dashboard/CardStatusOverview'
import WalletHero from '@/components/wallet/WalletHero'
import { cardStatusMockData } from '@/mock-data/cardStatusMockData'
import { paymentCardMockData } from '@/mock-data/paymentCardMockData'

export default function WalletPage() {
  const [cards, setCards] = useState(paymentCardMockData)
  const statusCounts = cards.reduce(
    (counts, item) => {
      if (item.card?.isDisabled) {
        counts.blocked += 1
        return counts
      }

      if (item.card?.isActive) {
        counts.active += 1
        return counts
      }

      counts.reported += 1
      return counts
    },
    {
      active: 0,
      blocked: 0,
      reported: 0,
    }
  )

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
      <CardStatusOverview
        title={cardStatusMockData.title}
        totalCards={cards.length}
        statuses={cardStatusMockData.statuses}
        statusCounts={statusCounts}
      />
      <CardCollectionView variant="carousel" items={cards} />
    </div>
  )
}
