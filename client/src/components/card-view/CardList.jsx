import PaymentCard from '@/components/payment-card/PaymentCard'

/**
 * List layout shell — renders cards in a responsive grid.
 * @param {{ items: { id: string, card: object }[] }} props
 */
export default function CardList({ items }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        No cards.
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <PaymentCard key={item.id} card={item.card} />
      ))}
    </div>
  )
}
