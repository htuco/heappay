import WalletSection from '@/components/wallet/WalletSection'
import CardCarousel from './CardCarousel'
import CardList from './CardList'

export default function CardCollectionView({ variant = 'carousel', items = [] }) {
  return (
    <WalletSection
      title="Payment Cards"
      subtitle={
        variant === 'carousel'
          ? 'Carousel preview with a centered active card and side previews.'
          : 'List preview showing all cards at once.'
      }
    >
      {variant === 'carousel' ? (
        <CardCarousel items={items} />
      ) : (
        <CardList items={items} />
      )}
    </WalletSection>
  )
}
