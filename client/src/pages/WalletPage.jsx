import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CreditCard, Snowflake } from 'lucide-react'

import AddCardModal from '@/components/AddCardModal'
import AllCardsModal from '@/components/wallet/AllCardsModal'
import CardStatsRow from '@/components/wallet/CardStatsRow'
import CardWidget from '@/components/wallet/CardWidget'
import WalletQuickActions from '@/components/wallet/WalletQuickActions'
import WalletTransactionsTable, {
  WalletTransactionsTableSkeleton,
} from '@/components/wallet/WalletTransactionsTable'
import { useWalletCards } from '@/hooks/useWalletCards'
import { buildCardStatusOverviewProps } from '@/utils/cardStatusOverview'

export default function WalletPage() {
  const { cards, isLoading, isSaving, error, saveError, addCard, setMainCard, removeCard } = useWalletCards()
  const [activeIndex, setActiveIndex] = useState(0)
  const [searchParams, setSearchParams] = useSearchParams()
  const [highlight, setHighlight] = useState(false)
  const consumedCardParamRef = useRef(null)
  const walletSectionRef = useRef(null)

  // Deep-link target from a notification: ?card=<id>. Scrolls to that card and
  // flashes a ring around the card widget.
  useEffect(() => {
    const param = searchParams.get('card')
    if (!param) return
    if (cards.length === 0) return
    if (consumedCardParamRef.current === param) return

    const index = cards.findIndex((c) => c.id === param)
    if (index < 0) return

    consumedCardParamRef.current = param
    /* eslint-disable react-hooks/set-state-in-effect */
    setActiveIndex(index)
    setHighlight(true)
    /* eslint-enable react-hooks/set-state-in-effect */
    walletSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const pulseTimer = setTimeout(() => setHighlight(false), 1800)

    const next = new URLSearchParams(searchParams)
    next.delete('card')
    setSearchParams(next, { replace: true })

    return () => clearTimeout(pulseTimer)
  }, [searchParams, cards, setSearchParams])

  const safeIndex = cards.length > 0 ? Math.min(activeIndex, cards.length - 1) : 0
  const activeCard = cards[safeIndex]

  const mainCard = cards.find((c) => c.isMain) ?? null
  const mainCardFrozen = mainCard?.card?.status === 'frozen'
  const hasActiveAlternative = cards.some(
    (c) => !c.isMain && c.card?.status === 'active',
  )

  const hasCards = cards.length > 0 || isLoading

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-panel border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive shadow-sm"
        >
          {error}
        </div>
      ) : null}

      {mainCardFrozen ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-panel border border-warning/40 bg-warning/10 px-5 py-4 text-sm text-warning-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <Snowflake className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <p className="text-card-foreground">
              <span className="font-semibold">Your main card is frozen.</span>{' '}
              {mainCard?.hasPendingUnfreeze
                ? 'An unfreeze request is under review.'
                : 'Request to activate it'}
              {!mainCard?.hasPendingUnfreeze && hasActiveAlternative
                ? ', or set another card as your main from Manage Cards.'
                : !mainCard?.hasPendingUnfreeze
                ? ' from Manage Cards.'
                : ''}
            </p>
          </div>
        </div>
      ) : null}

      {/*
        Desktop (lg+): two columns — transactions left (60%), rail right (40%).
        Mobile/tablet (< lg): single column, ordered Quick Actions → Carousel
        (card + balance) → Recent Activity → Card status. `order-*` reorders the
        stack on small screens; reset to source order on lg with `lg:order-none`.
      */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-5 lg:items-start lg:gap-6">
        {/* Quick Actions — second on mobile (under the card), top of right rail on desktop */}
        <div
          ref={walletSectionRef}
          className={`order-2 lg:order-0 lg:col-span-2 lg:col-start-4 lg:row-start-1 ${
            highlight ? 'rounded-panel ring-2 ring-primary ring-offset-2 ring-offset-background transition-shadow duration-500' : ''
          }`}
        >
          <WalletQuickActions
            onAddCard={addCard}
            isAddingCard={isSaving}
            addCardError={saveError}
            isLoading={isLoading && cards.length === 0}
          />
        </div>

        {/* Card widget (carousel + balance) — first on mobile, right rail on desktop */}
        {hasCards ? (
          <div className="order-1 lg:order-0 lg:col-span-2 lg:col-start-4 lg:row-start-2">
            <CardWidget
              cards={cards}
              activeIndex={safeIndex}
              onChangeIndex={setActiveIndex}
              activeCard={activeCard}
              isLoading={isLoading}
              addCardSlot={
                <AddCardModal
                  onSubmit={addCard}
                  isSubmitting={isSaving}
                  submitError={saveError}
                  triggerLabel="Add Card"
                  triggerVariant="default"
                  triggerClassName="h-11 w-full justify-center gap-2"
                />
              }
              manageCardsSlot={
                <AllCardsModal
                  items={cards}
                  triggerLabel="Manage Cards"
                  triggerVariant="outline"
                  triggerClassName="h-11 w-full justify-center gap-2"
                  onSetMain={setMainCard}
                  onRemove={removeCard}
                  addCardSlot={
                    <AddCardModal
                      onSubmit={addCard}
                      isSubmitting={isSaving}
                      submitError={saveError}
                      triggerLabel="Add new card"
                      triggerVariant="default"
                    />
                  }
                />
              }
            />
          </div>
        ) : null}

        {/* Recent activity — third on mobile, left 60% column (spanning rail rows)
            on desktop. h-full lets the panel stretch to the rail's full height so
            it isn't a short box against a taller right column. */}
        <div className="order-3 flex lg:order-0 lg:col-span-3 lg:col-start-1 lg:row-start-1 lg:row-span-3 lg:self-stretch">
          {isLoading && !activeCard ? (
            <WalletTransactionsTableSkeleton />
          ) : activeCard ? (
            <WalletTransactionsTable
              cardId={activeCard.id}
              card={{
                ...activeCard.card,
                last_four: activeCard.source?.last_four,
              }}
            />
          ) : (
            <section className="flex h-full min-h-96 w-full flex-col items-center justify-center gap-3 rounded-panel border border-border bg-card p-12 text-center shadow-sm">
              <span className="rounded-surface bg-linear-to-br from-primary to-primary-light p-3.5 text-primary-foreground shadow-lg shadow-primary/30">
                <CreditCard className="h-6 w-6" strokeWidth={2} />
              </span>
              <p className="text-base font-semibold text-card-foreground">No payment cards yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first card to start tracking activity.
              </p>
              <AddCardModal
                onSubmit={addCard}
                isSubmitting={isSaving}
                submitError={saveError}
                triggerLabel="Add Card"
                triggerVariant="default"
              />
            </section>
          )}
        </div>

        {/* Card status — last on mobile, bottom of right rail on desktop */}
        <div className="order-4 lg:order-0 lg:col-span-2 lg:col-start-4 lg:row-start-3">
          <CardStatsRow
            compact
            isLoading={isLoading && cards.length === 0}
            {...buildCardStatusOverviewProps(cards)}
          />
        </div>
      </div>
    </div>
  )
}
