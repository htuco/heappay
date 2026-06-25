import { Star, Wallet } from 'lucide-react'

import CardCarousel from '@/components/card-view/CardCarousel'
import Skeleton from '@/components/ui/skeleton'

const STATUS_META = {
  active: { label: 'Active', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  frozen: { label: 'Frozen', dot: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
  disabled: { label: 'Disabled', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  inactive: { label: 'Inactive', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
}

function formatBalance(value) {
  const num = Number(value ?? 0)
  if (Number.isNaN(num)) return '0.00'
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Card-shaped placeholder shown in the carousel slot while cards load. Mirrors
// the carousel stage's min-heights (CardCarousel CAROUSEL_STAGE_CLASS) so the
// slot reserves the same vertical space the real card will occupy — no shift
// when the carousel mounts. The inner block keeps the ~1.6:1 card aspect.
function CarouselSkeleton() {
  return (
    <div className="relative mx-auto flex w-full max-w-[290px] items-center justify-center px-6 py-5 min-h-[180px] sm:max-w-[380px] sm:px-8 sm:py-7 sm:min-h-[240px] md:min-h-[260px]">
      <Skeleton className="aspect-[1.6/1] w-[calc(100%-8px)] rounded-surface" />
    </div>
  )
}
export default function CardWidget({
  cards = [],
  activeIndex = 0,
  onChangeIndex,
  activeCard,
  isLoading = false,
  addCardSlot,
  manageCardsSlot,
}) {
  // Loading = cards still fetching and none resolved yet. Once a card exists we
  // render the real carousel/balance even if a background refresh is in flight,
  // so the skeleton only ever shows on the first paint.
  const showSkeleton = isLoading && !activeCard

  const hasCard = !!activeCard
  const balance = formatBalance(activeCard?.balance)
  const reservedAmount = Number(activeCard?.reserved ?? 0)
  const hasReserved = !Number.isNaN(reservedAmount) && reservedAmount > 0
  const reserved = formatBalance(activeCard?.reserved)
  const statusKey = activeCard?.card?.status ?? 'inactive'
  const status = STATUS_META[statusKey] ?? STATUS_META.inactive

  return (
    // Mobile: full-bleed, chromeless — the carousel runs edge-to-edge (break out
    // of the shell's px-4 with -mx-4) with no panel border/bg/radius. From sm up
    // it's a normal bordered panel.
    <section className="-mx-4 overflow-hidden sm:mx-0 sm:rounded-panel sm:border sm:border-border sm:bg-card sm:shadow-sm">
      {/* Card carousel — no top padding on mobile so the card sits at the top edge.
          Keep the divider between the carousel and balance at every width. */}
      <div className="border-b border-border/70 px-4 pt-0 pb-3 sm:px-6 sm:pt-5">
        {showSkeleton ? (
          <CarouselSkeleton />
        ) : (
          <CardCarousel items={cards} activeIndex={activeIndex} onChangeIndex={onChangeIndex} />
        )}
      </div>

      {/* Balance + status — the active card's money, as one block under it */}
      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Wallet className="size-3.5" strokeWidth={2.4} />
            Balance
          </span>
          {showSkeleton ? (
            <Skeleton className="h-4 w-16 rounded-chip" />
          ) : hasCard ? (
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status.text}`}>
              <span className={`size-1.5 rounded-full ${status.dot}`} aria-hidden />
              {status.label}
              {activeCard?.isMain ? (
                <span className="ml-1 inline-flex items-center gap-0.5 rounded-chip bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  <Star className="size-2.5 fill-primary" />
                  Main
                </span>
              ) : null}
            </span>
          ) : null}
        </div>

        {showSkeleton ? (
          // Mirror the loaded block's height: the balance line (text-4xl ≈ h-9)
          // plus the reserved line, so the box doesn't grow when figures land.
          <div className="mt-2 space-y-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        ) : (
          <>
            <p className="tabular mt-2 text-4xl font-bold leading-tight text-card-foreground" aria-live="polite">
              ${hasCard ? balance : '0.00'}
            </p>
            {hasReserved ? (
              <p
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                title="Funds held for payments that haven't settled yet. They're subtracted from your available balance."
              >
                <span>Reserved</span>
                <span className="tabular font-semibold text-card-foreground">${reserved}</span>
              </p>
            ) : null}
          </>
        )}

        {/* Actions — buttons render even during load (they're not data-bound), so
            the action area keeps its height; only the slots' own disabled state
            differs. Kept mounted to avoid reserving/duplicating their box. */}
        <div className="mt-5 flex flex-col gap-2">
          {addCardSlot}
          {manageCardsSlot}
        </div>
      </div>
    </section>
  )
}
