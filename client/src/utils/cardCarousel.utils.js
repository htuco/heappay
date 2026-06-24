export const CAROUSEL_TRANSITION_MS = 420

// --- Stack / wallet-shuffle animation tunables -----------------------------
// The stack stage renders every card absolutely-positioned and overlapping;
// stackStyle() below maps each card's offset from the active card to a
// transform. Tweak these to retune the shuffle without touching the markup.
export const STACK_EASE = 'cubic-bezier(0.34, 1.32, 0.46, 1)'
export const STACK_TRANSFORM_DURATION = '0.62s'
export const STACK_OPACITY_DURATION = '0.45s'
export const STACK_PEEK_X = 26 // px each upcoming card is nudged right
export const STACK_PEEK_Y = 8 // px each upcoming card is nudged down
export const STACK_SCALE_FALLOFF = 0.055 // scale lost per depth level
export const STACK_MAX_DEPTH = 3 // upcoming cards peek at most this deep
export const SWIPE_THRESHOLD = 40 // px of horizontal drag to trigger a card change

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

/**
 * Inline style for a card in the stack stage, given its offset from the active
 * card (`o = cardIndex - activeIndex`). Viewed cards (o < 0) slide off to the
 * left and fade out; upcoming cards (o > 0) peek behind the active one, capped
 * STACK_MAX_DEPTH deep; the active card (o === 0) sits on top and is the only
 * one that receives pointer events. When reduceMotion is set, transitions are
 * dropped so the swap is instant. Static styling stays in Tailwind/CSS — this
 * only owns the dynamic transform / opacity / z-index / pointer-events.
 *
 * The card wrapper is absolutely positioned at the stage centre (left/top 50%);
 * the centring -50%/-50% offset is baked into the transform here because an
 * inline transform overrides any Tailwind -translate-* utility on the same
 * element. Every branch therefore starts from `translate(-50%, -50%)`.
 */
export function stackStyle(o, reduceMotion = false) {
  const base = {
    transition: reduceMotion
      ? 'none'
      : `transform ${STACK_TRANSFORM_DURATION} ${STACK_EASE}, opacity ${STACK_OPACITY_DURATION} ease`,
    transformStyle: 'preserve-3d',
    willChange: 'transform, opacity',
    pointerEvents: o === 0 ? 'auto' : 'none',
  }

  if (o < 0) {
    // Already-viewed cards slide off to the left.
    return {
      ...base,
      transform: 'translate(-50%, -50%) translateX(-128%) rotate(-6deg)',
      opacity: 0,
      zIndex: 0,
    }
  }

  const k = Math.min(o, STACK_MAX_DEPTH)
  return {
    ...base,
    transform: `translate(-50%, -50%) translateX(${k * STACK_PEEK_X}px) translateY(${k * STACK_PEEK_Y}px) scale(${1 - k * STACK_SCALE_FALLOFF})`,
    opacity: o > STACK_MAX_DEPTH ? 0 : 1,
    zIndex: 100 - o * 5,
  }
}

export function getCarouselArrowGroupClass(count) {
  // Flank the card just inside the stage edges. The centered card is ~72% wide
  // (edges ~14% / ~86%), so anchoring arrows near the stage edges keeps them
  // clear of the card instead of overlapping it in a narrow column.
  const { left, right } =
    count === 2
      ? { left: 'left-[2%]', right: 'left-[98%]' }
      : { left: 'left-[3%]', right: 'left-[97%]' }
  // Hidden below md: percentage positions land on top of the card on a
  // phone-width stage, and the swipe gesture covers navigation there.
  // z-[200] keeps the arrows above the stacked cards (active card is z-100 via
  // stackStyle) so they stay clickable instead of sitting behind the card.
  const base = 'max-md:hidden absolute top-1/2 z-[200] -translate-x-1/2 -translate-y-1/2'
  return {
    left: `${base} ${left}`,
    right: `${base} ${right}`,
  }
}
