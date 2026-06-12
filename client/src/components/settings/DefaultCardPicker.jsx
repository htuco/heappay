import { useRef } from 'react'
import CardBrandIcon from '@/components/ui/CardBrandIcon'

/**
 * DefaultCardPicker — accessible radiogroup for choosing the main card.
 *
 * Each card is a `role="radio"` option. The group uses roving tabindex
 * (only the checked option, or the first when none is checked, is tabbable)
 * and Arrow keys move + select between options, matching the WAI-ARIA
 * radiogroup pattern.
 */
export default function DefaultCardPicker({ cards, onSelect }) {
  const optionRefs = useRef([])

  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">No payment cards found.</p>
  }

  const checkedIndex = cards.findIndex((item) => item.isMain)
  // When nothing is checked yet, the first option is the tab stop.
  const tabbableIndex = checkedIndex === -1 ? 0 : checkedIndex

  const moveTo = (index) => {
    const next = (index + cards.length) % cards.length
    const target = cards[next]
    optionRefs.current[next]?.focus()
    if (!target.isMain) onSelect(Number(target.id))
  }

  const handleKeyDown = (event, index) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        moveTo(index + 1)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        moveTo(index - 1)
        break
      case ' ':
      case 'Enter': {
        event.preventDefault()
        const item = cards[index]
        if (!item.isMain) onSelect(Number(item.id))
        break
      }
      default:
        break
    }
  }

  return (
    <div role="radiogroup" aria-label="Default card" className="space-y-2">
      {cards.map((item, index) => (
        <button
          key={item.id}
          ref={(el) => (optionRefs.current[index] = el)}
          type="button"
          role="radio"
          aria-checked={item.isMain}
          tabIndex={index === tabbableIndex ? 0 : -1}
          onClick={() => !item.isMain && onSelect(Number(item.id))}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={`flex w-full items-center gap-3 rounded-input border p-3 text-left transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${
            item.isMain
              ? 'border-primary/40 bg-primary/5'
              : 'border-border bg-card hover:border-primary/30 hover:bg-muted/20'
          }`}
        >
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              item.isMain ? 'border-primary bg-primary' : 'border-border'
            }`}
          >
            {item.isMain && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
            )}
          </span>
          <span className="flex h-8 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[6px] shadow-xs">
            <CardBrandIcon
              cardNumber={item.card.cardNumber}
              brand={item.card.brand}
              width={44}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm font-medium text-card-foreground">
              {item.card.cardNumber}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {item.card.brand} · expires {item.card.expiryDate}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}
