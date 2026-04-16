export const CAROUSEL_CYCLE_MS = 340

export const CAROUSEL_SLOT_SHELL =
  'pointer-events-none absolute top-1/2 w-[72%] max-w-[460px] -translate-y-1/2 transform'

export const CAROUSEL_LAYOUT_CLASS = {
  single: 'left-1/2 -translate-x-1/2 scale-100 opacity-100 z-20',
  centerPair:
    'left-[42%] sm:left-[43%] -translate-x-1/2 scale-100 opacity-100 z-20',
  rightPeek:
    'left-[57%] sm:left-[58%] -translate-x-1/2 scale-[0.88] opacity-70 z-10',
  left: 'left-[24%] -translate-x-1/2 scale-[0.88] opacity-70 z-10',
  center: 'left-1/2 -translate-x-1/2 scale-100 opacity-100 z-20',
  right: 'left-[76%] -translate-x-1/2 scale-[0.88] opacity-70 z-10',
}

export function getCarouselCyclicIndex(currentIndex, offset, length) {
  if (!length) return 0
  return (currentIndex + offset + length) % length
}

export function buildCarouselCardSlots(items, activeIndex, count) {
  if (count === 0) return []

  if (count === 1) {
    return [
      {
        key: `${items[0].id}-single`,
        item: items[0],
        layout: 'single',
        isCenter: true,
        animRole: 'main',
      },
    ]
  }

  if (count === 2) {
    const activeItem = items[activeIndex]
    const otherItem = items[getCarouselCyclicIndex(activeIndex, 1, 2)]
    return [
      {
        key: `${activeItem.id}-c-${activeIndex}`,
        item: activeItem,
        layout: 'centerPair',
        isCenter: true,
        animRole: 'main',
      },
      {
        key: `${otherItem.id}-p-${activeIndex}`,
        item: otherItem,
        layout: 'rightPeek',
        isCenter: false,
        animRole: 'side',
      },
    ]
  }

  return [-1, 0, 1].map((offset) => {
    const item = items[getCarouselCyclicIndex(activeIndex, offset, count)]
    const isCenter = offset === 0
    const layout = offset === -1 ? 'left' : offset === 0 ? 'center' : 'right'
    return {
      key: `${item.id}-${layout}-${activeIndex}`,
      item,
      layout,
      isCenter,
      animRole: isCenter ? 'main' : 'side',
    }
  })
}

export function getCarouselCycleAnimationClass(transitionId, cycleDir, animRole) {
  if (transitionId <= 0 || !cycleDir) return undefined
  const nextMain = 'animate-carousel-cycle-next-main'
  const nextSide = 'animate-carousel-cycle-next-side'
  const prevMain = 'animate-carousel-cycle-prev-main'
  const prevSide = 'animate-carousel-cycle-prev-side'
  if (cycleDir === 'next') {
    return animRole === 'main' ? nextMain : nextSide
  }
  return animRole === 'main' ? prevMain : prevSide
}

export function getCarouselArrowGroupClass(count) {
  const { left, right } =
    count === 2
      ? { left: 'left-[14%]', right: 'left-[90%]' }
      : { left: 'left-[24%]', right: 'left-[76%]' }
  const base =
    'absolute top-1/2 z-50 -translate-x-1/2 -translate-y-1/2'
  return {
    left: `${base} ${left}`,
    right: `${base} ${right}`,
  }
}
