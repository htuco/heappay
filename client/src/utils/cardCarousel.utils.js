export const CAROUSEL_TRANSITION_MS = 420

export const CAROUSEL_SLOT_SHELL =
  'carousel-card-slot-shell absolute top-1/2 w-[72%] max-w-[460px] -translate-y-1/2 transform'

export const CAROUSEL_LAYOUT_CLASS = {
  single: 'left-1/2 -translate-x-1/2 scale-100 opacity-100 z-20',
  centerPair:
    'left-[42%] sm:left-[43%] -translate-x-1/2 scale-100 opacity-100 z-20',
  rightPeek:
    'left-[57%] sm:left-[58%] -translate-x-1/2 scale-[0.88] opacity-50 z-10',
}

export function getCarouselCyclicIndex(currentIndex, offset, length) {
  if (!length) return 0
  return (currentIndex + offset + length) % length
}

/** Two-card wallet layout: active center, inactive peek on the right. */
export function buildDualCardSlots(items, activeIndex) {
  const count = items.length
  if (count === 0) return []
  if (count === 1) {
    return [
      {
        key: items[0].id,
        item: items[0],
        layout: 'single',
        isCenter: true,
        animRole: 'main',
      },
    ]
  }

  return items.map((item, index) => {
    const isCenter = index === activeIndex
    return {
      key: item.id,
      item,
      layout: isCenter ? 'centerPair' : 'rightPeek',
      isCenter,
      animRole: isCenter ? 'main' : 'side',
    }
  })
}

export function getCarouselCycleAnimationClass(transitionId, cycleDir, animRole) {
  if (transitionId <= 0 || !cycleDir) return undefined
  if (cycleDir === 'next') {
    return animRole === 'main' ? 'animate-carousel-cycle-next-main' : 'animate-carousel-cycle-next-side'
  }
  return animRole === 'main' ? 'animate-carousel-cycle-prev-main' : 'animate-carousel-cycle-prev-side'
}

export function getCarouselArrowGroupClass(count) {
  const { left, right } =
    count === 2
      ? { left: 'left-[14%]', right: 'left-[90%]' }
      : { left: 'left-[24%]', right: 'left-[76%]' }
  const base = 'absolute top-1/2 z-50 -translate-x-1/2 -translate-y-1/2'
  return {
    left: `${base} ${left}`,
    right: `${base} ${right}`,
  }
}
