import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CreditCard, Star, X } from 'lucide-react'

import PaymentCard from '@/components/payment-card/PaymentCard'
import { Button } from '@/components/ui/button'

const DEFAULT_TRIGGER_CLASS =
  'border-border/80 bg-background/90 shadow-sm hover:bg-muted dark:border-white/20 dark:bg-card/70 dark:hover:border-white/30 dark:hover:bg-card'

export default function AllCardsModal({
  items = [],
  triggerLabel = 'See All Cards',
  triggerClassName,
  triggerVariant = 'outline',
  onSetMain,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)
  const modalItems = items.map((item) => ({
    ...item,
    card: {
      ...item.card,
      isActive: false,
    },
  }))

  function openModal() {
    setAnimateIn(false)
    setIsOpen(true)
  }

  function closeModal() {
    setAnimateIn(false)
    setIsOpen(false)
  }

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setAnimateIn(false)
        setIsOpen(false)
      }
    }

    const animationTimer = window.setTimeout(() => {
      setAnimateIn(true)
    }, 40)

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(animationTimer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const modal = (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeModal()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="all-cards-modal-title"
      aria-describedby="all-cards-modal-description"
    >
      <div className="relative max-h-[90vh] w-full max-w-6xl overflow-auto rounded-lg border bg-background shadow-lg">
        <div className="flex items-start justify-between border-b px-5 py-4 sm:px-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
              <CreditCard className="h-3.5 w-3.5" />
              Wallet Cards
            </div>
            <div className="space-y-1">
              <h2
                id="all-cards-modal-title"
                className="text-2xl font-black tracking-tight text-card-foreground sm:text-3xl"
              >
                Your Cards
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Browse every card in your wallet in one place, with a clean
                overview of each brand and expiry date.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-full p-2 transition-colors hover:bg-muted"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div
          id="all-cards-modal-description"
          className="space-y-4 px-5 py-5 sm:px-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {modalItems.length} {modalItems.length === 1 ? 'Card' : 'Cards'}
            </div>
          </div>
          {modalItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              No cards.
            </div>
          ) : (
            <div
              className={[
                'grid gap-4 transition-opacity duration-300 ease-out sm:grid-cols-2 xl:grid-cols-3',
                animateIn ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
            >
              {modalItems.map((item) => (
                <div key={item.id} className="flex flex-col gap-2">
                  <PaymentCard card={item.card} />
                  {onSetMain && (
                    item.isMain ? (
                      <div className="flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/8 py-2 text-xs font-semibold text-primary">
                        <Star className="h-3.5 w-3.5 fill-primary" />
                        Main card
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSetMain(Number(item.id))}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/30 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                      >
                        <Star className="h-3.5 w-3.5" />
                        Set as main
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Button
        variant={triggerVariant}
        onClick={openModal}
        className={triggerClassName ?? DEFAULT_TRIGGER_CLASS}
      >
        <CreditCard />
        {triggerLabel}
      </Button>

      {isOpen ? createPortal(modal, document.body) : null}
    </>
  )
}
