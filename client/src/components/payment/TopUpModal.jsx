import { useEffect, useRef, useState } from 'react'
import { Check, CheckCircle2, CreditCard, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import FormBanner from '@/components/ui/FormBanner'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/context/NotificationContext'
import { listCards } from '@/services/cardsService'
import transactionTypesService from '@/services/transactionTypesService'
import transactionsService from '@/services/transactionsService'
import { DATA_CHANGE_KINDS, emitDataChange } from '@/utils/dataEvents'

function formatAmount(value) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('')
  if (parts[1]?.length > 2) return parts[0] + '.' + parts[1].slice(0, 2)
  return cleaned
}

export default function TopUpModal({ isOpen, onClose, onSuccess, initialCardId = null }) {
  const { user } = useAuth()
  const { notify } = useNotifications()

  const [cards, setCards] = useState([])
  const [depositTypeId, setDepositTypeId] = useState(null)
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const amountInputRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !user) return
    setIsLoading(true)
    Promise.all([
      listCards({ user_id: user.id, limit: 100 }),
      transactionTypesService.list(),
    ])
      .then(([raw, types]) => {
        const active = raw.filter((c) => !c.deleted_at)
        setCards(active)
        if (initialCardId && active.some((c) => c.card_id === initialCardId)) {
          setSelectedCardId(initialCardId)
        } else if (active.length === 1) {
          setSelectedCardId(active[0].card_id)
        }
        const deposit = types.find((t) => t.name === 'deposit')
        setDepositTypeId(deposit?.transaction_type_id ?? null)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [isOpen, user])

  function handleClose() {
    setSelectedCardId(null)
    setAmount('')
    setError('')
    onClose()
  }

  async function handleSubmit() {
    const amountNum = parseFloat(amount)
    if (!selectedCardId || isNaN(amountNum) || amountNum <= 0) return
    if (!depositTypeId) {
      setError('Deposit is not available right now. Please try again later.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const card = cards.find((c) => c.card_id === selectedCardId)
      await transactionsService.create({
        sender_card_id: null,
        recipient_card_id: selectedCardId,
        transaction_type_id: depositTypeId,
        amount: amountNum.toFixed(2),
        note: null,
      })

      notify({
        type: 'success',
        message: `$${amountNum.toFixed(2)} added to card ****${card.last_four}.`,
      })
      emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
      onSuccess?.()
      handleClose()
    } catch (err) {
      setError(err?.message || 'Top-up failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCard = cards.find((c) => c.card_id === selectedCardId) ?? null
  const amountNum = parseFloat(amount)
  const canSubmit = selectedCardId && !isNaN(amountNum) && amountNum > 0 && !isSubmitting

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Top Up" size="default">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Card selection */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-card-foreground">Select card</p>
            {cards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                No active cards found.
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
                {cards.map((c) => {
                  const selected = selectedCardId === c.card_id
                  return (
                    <button
                      key={c.card_id}
                      type="button"
                      onClick={() => setSelectedCardId(c.card_id)}
                      className={`group w-full rounded-2xl border p-4 text-left transition-all duration-200 ${
                        selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/25'
                          : 'border-border bg-card hover:border-primary/30 hover:bg-muted/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                              selected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-primary/10 text-primary'
                            }`}
                          >
                            <CreditCard className="h-4 w-4" strokeWidth={2} />
                          </span>
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-semibold text-card-foreground">
                              {c.masked_card_number}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Balance:{' '}
                              <span className="font-medium text-card-foreground">
                                ${Number(c.balance).toFixed(2)}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                            selected ? 'border-primary bg-primary' : 'border-border'
                          }`}
                        >
                          {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Amount input */}
          <div
            className="flex flex-col items-center gap-1.5 rounded-3xl border border-border bg-muted/20 py-6 cursor-text"
            onClick={() => amountInputRef.current?.focus()}
          >
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Deposit amount
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-light text-muted-foreground">$</span>
              <input
                ref={amountInputRef}
                type="text"
                value={amount}
                onChange={(e) => setAmount(formatAmount(e.target.value))}
                placeholder="0.00"
                inputMode="decimal"
                className="w-40 bg-transparent text-center text-5xl font-bold caret-transparent outline-none placeholder:text-muted-foreground/30 text-card-foreground"
              />
            </div>
            {selectedCard && (
              <p className="text-xs text-muted-foreground">
                New balance:{' '}
                <span className="font-semibold text-card-foreground">
                  $
                  {(
                    Number(selectedCard.balance) + (isNaN(amountNum) ? 0 : amountNum)
                  ).toFixed(2)}
                </span>
              </p>
            )}
          </div>

          {error && <FormBanner variant="error" message={error} />}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding funds…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Add Funds
              </>
            )}
          </Button>
        </div>
      )}
    </Modal>
  )
}
