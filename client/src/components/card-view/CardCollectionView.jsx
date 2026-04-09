import CardCarousel from './CardCarousel'
import CardList from './CardList'

/**
 * Viewer: picks list vs carousel by variant.
 * @param {{ variant?: 'carousel' | 'list', items?: { id: string, card: object }[] }} props
 */
export default function CardCollectionView({ variant = 'carousel', items = [] }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-card-foreground sm:text-xl">
          Payment Cards
        </h2>
        <p className="text-sm text-muted-foreground">
          {variant === 'carousel'
            ? 'Carousel view (skeleton). List view is live in the grid.'
            : 'All cards in a grid.'}
        </p>
      </header>

      {variant === 'carousel' ? (
        <CardCarousel items={items} />
      ) : (
        <CardList items={items} />
      )}
    </section>
  )
}
