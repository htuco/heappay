import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PaymentCard from '@/components/payment-card/PaymentCard'
import CarouselArrowButton from './CarouselArrowButton'
import {
  buildCarouselCardSlots,
  CAROUSEL_CYCLE_MS,
  CAROUSEL_LAYOUT_CLASS,
  CAROUSEL_SLOT_SHELL,
  getCarouselArrowGroupClass,
  getCarouselCycleAnimationClass,
  getCarouselCyclicIndex,
} from '@/utils/cardCarousel.utils'

export default function CardCarousel({ items, activeIndex: controlledIndex, onChangeIndex }) {
  const isControlled = controlledIndex != null
  const [internalIndex, setInternalIndex] = useState(0)
  const activeIndex = isControlled ? controlledIndex : internalIndex

  const [previousIndex, setPreviousIndex] = useState(activeIndex)
  const [animation, setAnimation] = useState({ id: 0, dir: null })
  const animatingRef = useRef(false)
  const timeoutRef = useRef(null)

  const count = items.length

  if (previousIndex !== activeIndex) {
    setPreviousIndex(activeIndex)
    setAnimation((prev) => ({
      id: prev.id + 1,
      dir: activeIndex > previousIndex ? 'next' : 'prev',
    }))
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  const cardSlots = useMemo(
    () => buildCarouselCardSlots(items, activeIndex, count),
    [items, activeIndex, count]
  )

  const arrows = getCarouselArrowGroupClass(count)
  const arrowsDisabled = count <= 1

  const navigate = useCallback(
    (delta) => {
      if (count <= 1 || animatingRef.current) return

      animatingRef.current = true
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)

      const nextIndex = getCarouselCyclicIndex(activeIndex, delta, count)
      if (isControlled) {
        onChangeIndex?.(nextIndex)
      } else {
        setInternalIndex(nextIndex)
        onChangeIndex?.(nextIndex)
      }

      timeoutRef.current = window.setTimeout(() => {
        animatingRef.current = false
      }, CAROUSEL_CYCLE_MS)
    },
    [activeIndex, count, isControlled, onChangeIndex]
  )

  if (count === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-sm text-muted-foreground">
        No cards available for carousel preview.
      </div>
    )
  }

  return (
    <section className="space-y-3">
      <div className="relative mx-auto h-[240px] w-full max-w-4xl overflow-hidden rounded-2xl sm:h-[280px] md:h-[310px]">
        {cardSlots.map(({ key, item, layout, isCenter, animRole }) => (
          <div
            key={key}
            className={['carousel-card-slot', CAROUSEL_SLOT_SHELL, CAROUSEL_LAYOUT_CLASS[layout]].join(
              ' '
            )}
            aria-hidden={!isCenter}
          >
            <div
              key={`${layout}-${animation.id}`}
              className={getCarouselCycleAnimationClass(
                animation.id,
                animation.dir,
                animRole
              )}
            >
              <PaymentCard card={{ ...item.card, isActive: isCenter }} />
            </div>
          </div>
        ))}

        <CarouselArrowButton
          direction="left"
          disabled={arrowsDisabled}
          onClick={() => navigate(-1)}
          className={arrows.left}
        />
        <CarouselArrowButton
          direction="right"
          disabled={arrowsDisabled}
          onClick={() => navigate(1)}
          className={arrows.right}
        />
      </div>

      <div className="flex items-center justify-center">
        <p className="min-w-24 text-center text-xs font-medium text-muted-foreground sm:text-sm">
          Card {activeIndex + 1} of {count}
        </p>
      </div>
    </section>
  )
}
