import { useCallback, useEffect, useRef, useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { A11y, EffectCreative, Keyboard } from 'swiper/modules'

import PaymentCard from '@/components/payment-card/PaymentCard'
import CarouselArrowButton from './CarouselArrowButton'
import {
  buildDualCardSlots,
  CAROUSEL_LAYOUT_CLASS,
  CAROUSEL_SLOT_SHELL,
  CAROUSEL_TRANSITION_MS,
  getCarouselArrowGroupClass,
  getCarouselCycleAnimationClass,
  getCarouselCyclicIndex,
} from '@/utils/cardCarousel.utils'

import 'swiper/css'
import 'swiper/css/effect-creative'

const SWIPER_MODULES = [EffectCreative, A11y, Keyboard]

const CREATIVE_EFFECT = {
  limitProgress: 1,
  perspective: false,
  prev: {
    translate: ['-22%', 0, 0],
    scale: 0.88,
    opacity: 0.5,
    rotate: [0, 0, 0],
  },
  next: {
    translate: ['14%', 0, 0],
    scale: 0.88,
    opacity: 0.5,
    rotate: [0, 0, 0],
  },
}

const CAROUSEL_STAGE_CLASS =
  'relative mx-auto w-full max-w-4xl overflow-visible px-2 py-8 min-h-[290px] sm:min-h-[310px] md:min-h-[330px]'

function getPrefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function CardCarouselDual({
  items,
  visibleIndex,
  cycleAnim,
  arrows,
  arrowsDisabled,
  onNavigate,
  onSelectIndex,
}) {
  const slots = buildDualCardSlots(items, visibleIndex)
  const count = items.length

  return (
    <div className={CAROUSEL_STAGE_CLASS}>
      {slots.map(({ key, item, layout, isCenter, animRole }) => (
        <div
          key={key}
          className={['carousel-card-slot', CAROUSEL_SLOT_SHELL, CAROUSEL_LAYOUT_CLASS[layout]].join(
            ' '
          )}
          aria-hidden={!isCenter}
        >
          <div
            key={`${layout}-${cycleAnim.id}`}
            className={getCarouselCycleAnimationClass(
              cycleAnim.id,
              cycleAnim.dir,
              animRole
            )}
          >
            <PaymentCard
              card={{ ...item.card, isActive: isCenter }}
              className={[
                'card-carousel-payment-card',
                isCenter
                  ? 'card-carousel-payment-card--active'
                  : 'card-carousel-payment-card--inactive',
              ].join(' ')}
              onClick={
                count > 1 && !isCenter
                  ? () => onSelectIndex(getCarouselCyclicIndex(visibleIndex, 1, 2))
                  : undefined
              }
            />
          </div>
        </div>
      ))}

      {!arrowsDisabled ? (
        <>
          <CarouselArrowButton
            direction="left"
            onClick={() => onNavigate(-1)}
            className={arrows.left}
          />
          <CarouselArrowButton
            direction="right"
            onClick={() => onNavigate(1)}
            className={arrows.right}
          />
        </>
      ) : null}
    </div>
  )
}

function CardCarouselSwiper({
  items,
  activeIndex,
  visibleIndex,
  transitionSpeed,
  arrows,
  arrowsDisabled,
  swiperRef,
  onSlideChange,
  onNavigate,
  onSelectIndex,
}) {
  const count = items.length

  useEffect(() => {
    const swiper = swiperRef.current
    if (!swiper || swiper.destroyed || swiper.activeIndex === activeIndex) return
    swiper.slideTo(activeIndex, transitionSpeed)
  }, [activeIndex, swiperRef, transitionSpeed])

  return (
    <div className={CAROUSEL_STAGE_CLASS}>
      <Swiper
        className="card-carousel-swiper h-full min-h-[240px] w-full"
        modules={SWIPER_MODULES}
        effect="creative"
        grabCursor={count > 1}
        allowTouchMove={count > 1}
        watchSlidesProgress
        speed={transitionSpeed}
        initialSlide={activeIndex}
        slidesPerView={1}
        centeredSlides
        creativeEffect={CREATIVE_EFFECT}
        keyboard={{ enabled: count > 1 }}
        a11y={{
          enabled: true,
          prevSlideMessage: 'Previous card',
          nextSlideMessage: 'Next card',
        }}
        onSwiper={(swiper) => {
          swiperRef.current = swiper
        }}
        onSlideChangeTransitionStart={onSlideChange}
        onSlideChange={onSlideChange}
      >
        {items.map((item, index) => {
          const isCenter = index === visibleIndex
          return (
            <SwiperSlide key={item.id} className="card-carousel-slide">
              <PaymentCard
                card={{ ...item.card, isActive: isCenter }}
                className={[
                  'card-carousel-payment-card',
                  isCenter
                    ? 'card-carousel-payment-card--active'
                    : 'card-carousel-payment-card--inactive',
                ].join(' ')}
                onClick={count > 1 && !isCenter ? () => onSelectIndex(index) : undefined}
              />
            </SwiperSlide>
          )
        })}
      </Swiper>

      {!arrowsDisabled ? (
        <>
          <CarouselArrowButton
            direction="left"
            onClick={() => onNavigate(-1)}
            className={arrows.left}
          />
          <CarouselArrowButton
            direction="right"
            onClick={() => onNavigate(1)}
            className={arrows.right}
          />
        </>
      ) : null}
    </div>
  )
}

export default function CardCarousel({ items, activeIndex: controlledIndex, onChangeIndex }) {
  const swiperRef = useRef(null)
  const [reduceMotion] = useState(getPrefersReducedMotion)
  const count = items.length
  const activeIndex = controlledIndex ?? 0
  const [visibleIndex, setVisibleIndex] = useState(activeIndex)
  const [cycleAnim, setCycleAnim] = useState({ id: 0, dir: null })
  const useDualLayout = count <= 2

  useEffect(() => {
    setVisibleIndex(activeIndex)
  }, [activeIndex])

  const arrows = getCarouselArrowGroupClass(count)
  const arrowsDisabled = count <= 1
  const transitionSpeed = reduceMotion ? 0 : CAROUSEL_TRANSITION_MS

  const handleSlideChange = useCallback(
    (swiper) => {
      setVisibleIndex(swiper.activeIndex)
      onChangeIndex?.(swiper.activeIndex)
    },
    [onChangeIndex]
  )

  const goToIndex = useCallback(
    (index, delta) => {
      if (useDualLayout) {
        if (delta != null) {
          setCycleAnim((prev) => ({
            id: prev.id + 1,
            dir: delta > 0 ? 'next' : 'prev',
          }))
        }
        setVisibleIndex(index)
        onChangeIndex?.(index)
        return
      }
      const swiper = swiperRef.current
      if (!swiper || index === swiper.activeIndex) return
      swiper.slideTo(index, transitionSpeed)
    },
    [onChangeIndex, transitionSpeed, useDualLayout]
  )

  const navigate = useCallback(
    (delta) => {
      if (count <= 1) return
      if (useDualLayout) {
        setCycleAnim((prev) => ({
          id: prev.id + 1,
          dir: delta > 0 ? 'next' : 'prev',
        }))
        const next = getCarouselCyclicIndex(visibleIndex, delta, count)
        setVisibleIndex(next)
        onChangeIndex?.(next)
        return
      }
      const swiper = swiperRef.current
      if (!swiper) return
      if (delta > 0) swiper.slideNext(transitionSpeed)
      else swiper.slidePrev(transitionSpeed)
    },
    [count, goToIndex, transitionSpeed, useDualLayout, visibleIndex]
  )

  if (count === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-sm text-muted-foreground">
        No cards available for carousel preview.
      </div>
    )
  }

  return (
    <section className="space-y-3" aria-roledescription="carousel" aria-label="Payment cards">
      {useDualLayout ? (
        <CardCarouselDual
          items={items}
          visibleIndex={visibleIndex}
          cycleAnim={cycleAnim}
          arrows={arrows}
          arrowsDisabled={arrowsDisabled}
          onNavigate={navigate}
          onSelectIndex={(index) => {
            const delta = index === getCarouselCyclicIndex(visibleIndex, 1, count) ? 1 : -1
            goToIndex(index, delta)
          }}
        />
      ) : (
        <CardCarouselSwiper
          items={items}
          activeIndex={activeIndex}
          visibleIndex={visibleIndex}
          transitionSpeed={transitionSpeed}
          arrows={arrows}
          arrowsDisabled={arrowsDisabled}
          swiperRef={swiperRef}
          onSlideChange={handleSlideChange}
          onNavigate={navigate}
          onSelectIndex={goToIndex}
        />
      )}

      <div className="flex items-center justify-center">
        <p className="min-w-24 text-center text-xs font-medium text-muted-foreground sm:text-sm">
          Card {visibleIndex + 1} of {count}
        </p>
      </div>
    </section>
  )
}
