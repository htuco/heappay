import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function CarouselArrowButton({
  direction,
  onClick,
  className,
  disabled = false,
}) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight
  const ariaLabel = direction === 'left' ? 'Previous card' : 'Next card'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      className={[
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-card-foreground shadow-none outline-none',
        'touch-manipulation select-none',
        'transition-[colors,transform] duration-200 ease-out',
        'hover:border-accent hover:bg-accent hover:text-accent-foreground hover:scale-105',
        'active:scale-95 active:bg-accent/90 active:text-accent-foreground',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40',
        'disabled:border-border disabled:bg-card disabled:text-muted-foreground',
        'disabled:hover:border-border disabled:hover:bg-card disabled:hover:text-muted-foreground',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
    </button>
  )
}
