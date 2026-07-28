import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import CardBrandIcon from '@/components/ui/CardBrandIcon'
import { useAppSelector } from '@/store/hooks'
import { selectCardStatuses, selectCardTypes } from '@/store/slices/referenceDataSlice'
import {
  freezeDependentCard,
  listDependentCards,
  unfreezeDependentCard,
} from '@/services/familyService'

export default function DependentCardsPanel({ dependentUserId }) {
  const cardTypes = useAppSelector(selectCardTypes)
  const typesById = useMemo(
    () => Object.fromEntries((cardTypes ?? []).map((t) => [t.card_type_id, t])),
    [cardTypes],
  )
  const cardStatuses = useAppSelector(selectCardStatuses)
  const statusNameById = useMemo(
    () => Object.fromEntries((cardStatuses ?? []).map((s) => [s.card_status_id, s.status_name])),
    [cardStatuses],
  )

  const [cards, setCards] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    listDependentCards(dependentUserId)
      .then(setCards)
      .catch(() => setError('Failed to load cards.'))
      .finally(() => setIsLoading(false))
  }, [dependentUserId])

  const isCardFrozen = (card) => statusNameById[card.status_id] === 'frozen'

  async function toggle(card) {
    setPendingId(card.card_id)
    try {
      const updated = isCardFrozen(card)
        ? await unfreezeDependentCard(dependentUserId, card.card_id)
        : await freezeDependentCard(dependentUserId, card.card_id)
      setCards((prev) => prev.map((c) => (c.card_id === updated.card_id ? updated : c)))
    } catch {
      // keep the previous state; the button just re-enables for a retry
    } finally {
      setPendingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading cards…
      </div>
    )
  }
  if (error) return <p className="py-4 text-sm text-destructive">{error}</p>
  if (cards.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">No cards on this account.</p>
  }

  return (
    <div className="rounded-input border border-border overflow-hidden">
      <div className="hidden grid-cols-[1fr_88px_88px_88px] gap-4 border-b border-border bg-muted/30 px-4 py-2.5 sm:grid">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Card
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Type
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Status
        </span>
        <span />
      </div>
      <div className="divide-y divide-border/60">
        {cards.map((card) => {
          const frozen = isCardFrozen(card)
          const type = typesById[card.card_type_id]
          return (
            <div
              key={card.card_id}
              className="flex flex-col gap-3 px-4 py-3 sm:grid sm:grid-cols-[1fr_88px_88px_88px] sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <CardBrandIcon brand={type?.vendor} width={42} />
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium text-foreground">
                    {card.masked_card_number}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{card.cardholder_name}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:contents">
                <span className="text-xs capitalize text-muted-foreground">
                  {type?.type_name ?? '—'}
                </span>
                <Badge variant={frozen ? 'warning' : 'success'} className="w-fit">
                  {frozen ? 'Frozen' : 'Active'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-input px-3 text-xs shadow-none touch-manipulation sm:h-7 sm:w-full"
                  disabled={pendingId === card.card_id}
                  onClick={() => toggle(card)}
                >
                  {pendingId === card.card_id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : frozen ? (
                    'Unfreeze'
                  ) : (
                    'Freeze'
                  )}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
