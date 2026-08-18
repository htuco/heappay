import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import PaymentCard from '@/components/payment-card/PaymentCard'
import CarouselArrowButton from './CarouselArrowButton'
import {
  getCarouselArrowGroupClass,
  stackStyle,
  SWIPE_THRESHOLD,
} from '@/utils/cardCarousel.utils'
import { getPrefersReducedMotion } from '@/utils/prefersReducedMotion'

const CAROUSEL_STAGE_CLASS =
  // overflow-visible so the active card's scale + shadow render fully at every
  // width. The horizontal padding (px-*) reserves room on the right for the
  // upcoming cards to peek into, and the vertical padding (py-*) reserves room
  // below for the downward peek + the slide-off so the stack never spills over
  // the counter. The card wrapper is capped narrower than the stage (see
  // CAROUSEL_CARD_WRAPPER) so the active card sits inset from the peek margin.
  // The capped width keeps the card small on phones (its width drives
  // --rccs-scale); the sm+ cap is modest (not max-w-4xl) so the card fits a
  // narrow right-rail column between lg and xl without overscaling.
  'relative mx-auto flex w-full max-w-[290px] items-center justify-center overflow-visible px-6 py-5 min-h-[180px] sm:max-w-[380px] sm:px-8 sm:py-7 sm:min-h-[240px] md:min-h-[260px] [perspective:1700px]'

// Active card wrapper: capped a touch narrower than the stage's content box so
// the peeking cards behind it (translated right/down by stackStyle) stay within
// the stage's padding instead of bleeding past its edges.
const CAROUSEL_CARD_WRAPPER =
  'absolute left-1/2 top-1/2 w-[calc(100%-8px)]'

export default function CardCarousel({ items, activeIndex: controlledIndex, onChangeIndex }) {
  const [reduceMotion] = useState(getPrefersReducedMotion)
  const count = items.length
  const activeIndex = controlledIndex ?? 0
  const [visibleIndex, setVisibleIndex] = useState(activeIndex)

  useEffect(() => {
    setVisibleIndex(activeIndex)
  }, [activeIndex])

  const arrows = getCarouselArrowGroupClass(count)

  const goToIndex = useCallback(
    (index) => {
      if (index < 0 || index > count - 1 || index === visibleIndex) return
      setVisibleIndex(index)
      onChangeIndex?.(index)
    },
    [count, onChangeIndex, visibleIndex]
  )

  const navigate = useCallback(
    (delta) => goToIndex(visibleIndex + delta),
    [goToIndex, visibleIndex]
  )

  // Touch-only swipe so mobile keeps card navigation (the stack stage has no
  // swiper gesture, and the arrows are hidden below md). Desktop mouse/click is
  // untouched — these handlers only fire for touch input. Swipe left = next,
  // right = prev; clamped via navigate/goToIndex.
  const touchStartX = useRef(null)
  const handleTouchStart = useCallback((event) => {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }, [])
  const handleTouchEnd = useCallback(
    (event) => {
      const startX = touchStartX.current
      touchStartX.current = null
      if (startX == null || count <= 1) return
      const deltaX = (event.changedTouches[0]?.clientX ?? startX) - startX
      if (Math.abs(deltaX) < SWIPE_THRESHOLD) return
      navigate(deltaX < 0 ? 1 : -1)
    },
    [count, navigate]
  )

  if (count === 0) {
    return (
      <div className="rounded-surface border border-dashed border-border bg-muted/30 p-8 text-sm text-muted-foreground">
        No cards available for carousel preview.
      </div>
    )
  }

  const atStart = visibleIndex <= 0
  const atEnd = visibleIndex >= count - 1
  const showArrows = count > 1

  return (
    <section className="space-y-3" aria-roledescription="carousel" aria-label="Payment cards">
      <div
        className={CAROUSEL_STAGE_CLASS}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {items.map((item, index) => {
          const offset = index - visibleIndex
          const isCenter = offset === 0
          return (
            <div
              key={item.id}
              className={CAROUSEL_CARD_WRAPPER}
              style={stackStyle(offset, reduceMotion)}
              aria-hidden={!isCenter}
            >
              <PaymentCard
                card={{ ...item.card, isActive: isCenter }}
                className={[
                  'payment-card-fit',
                  'card-carousel-payment-card',
                  isCenter
                    ? 'card-carousel-payment-card--active'
                    : 'card-carousel-payment-card--inactive',
                ].join(' ')}
                onClick={count > 1 && !isCenter ? () => goToIndex(index) : undefined}
              />
            </div>
          )
        })}

        {showArrows ? (
          <>
            <CarouselArrowButton
              direction="left"
              onClick={() => navigate(-1)}
              disabled={atStart}
              className={arrows.left}
            />
            <CarouselArrowButton
              direction="right"
              onClick={() => navigate(1)}
              disabled={atEnd}
              className={arrows.right}
            />
          </>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col items-center justify-center gap-1 sm:mt-3">
        <p
          className="min-w-24 text-center text-xs font-medium text-muted-foreground sm:text-sm"
          aria-live="polite"
        >
          Card {visibleIndex + 1} of {count}
        </p>
        {/* Swipe affordance — mobile only (below md), where arrows are hidden
            and swipe is the navigation. Hidden when there's nothing to swipe to. */}
        {showArrows ? (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground md:hidden">
            <ChevronLeft className="size-3" aria-hidden />
            Swipe to switch cards
            <ChevronRight className="size-3" aria-hidden />
          </p>
        ) : null}
      </div>
    </section>
  )
}
