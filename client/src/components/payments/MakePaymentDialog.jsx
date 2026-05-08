import { useState } from 'react'
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

const TRANSACTION_TYPE_OPTIONS = [
  { value: '2', label: 'Payment' },
  { value: '4', label: 'Withdrawal' },
  { value: '3', label: 'Refund' },
]

export default function MakePaymentDialog({ open, onClose, cards = [] }) {
  const [recipientCardId, setRecipientCardId] = useState('')
  const [transactionTypeId, setTransactionTypeId] = useState('2')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  function handleClose() {
    setRecipientCardId('')
    setTransactionTypeId('2')
    setAmount('')
    setNote('')
    onClose()
  }

  const cardOptions = cards.map((c) => ({
    value: String(c.card_id),
    label: `${c.brand?.toUpperCase() ?? 'Card'} •••• ${c.last_four ?? c.card_id}`,
  }))

  return (
    <DialogRoot open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Make a Payment</DialogTitle>
          <DialogDescription>Fill in the details to send a payment.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Type</label>
            <Select
              value={transactionTypeId}
              onChange={(e) => setTransactionTypeId(e.target.value)}
              options={TRANSACTION_TYPE_OPTIONS}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Recipient Card
            </label>
            {cardOptions.length > 0 ? (
              <Select
                value={recipientCardId}
                onChange={(e) => setRecipientCardId(e.target.value)}
                options={cardOptions}
                placeholder="Select a card"
              />
            ) : (
              <Input value="" placeholder="Card ID" onChange={(e) => setRecipientCardId(e.target.value)} />
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Amount (USD)
            </label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Note <span className="normal-case text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleClose}>
            Send Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
