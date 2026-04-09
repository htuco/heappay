/**
 * Carousel shell — replace with real carousel in a later commit.
 * @param {{ items: { id: string, card: object }[] }} props
 */
export default function CardCarousel({ items }) {
  const count = items.length

  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground">
      {count === 0 ? (
        <span>No cards.</span>
      ) : (
        <span>
          Carousel skeleton — {count} card{count === 1 ? '' : 's'}
        </span>
      )}
    </div>
  )
}
