import { useState, useEffect } from 'react'
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

export default function ManageCardDialog({ card, onClose, onUpdate, onDelete, isAdmin, cardStatuses }) {
  const [selectedStatusId, setSelectedStatusId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (card) {
      setSelectedStatusId(String(card.statusId ?? ''))
      setError('')
    }
  }, [card])

  async function handleSave() {
    if (!selectedStatusId) return
    setIsSaving(true)
    setError('')
    try {
      await onUpdate(card.rawId, { status_id: Number(selectedStatusId) })
    } catch (err) {
      setError(err?.message || 'Failed to update card.')
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    setError('')
    try {
      await onDelete(card.rawId)
    } catch (err) {
      setError(err?.message || 'Failed to delete card.')
      setIsDeleting(false)
    }
  }

  const statusOptions = cardStatuses.map((s) => ({
    value: String(s.card_status_id),
    label: s.status_name,
  }))

  return (
    <DialogRoot open={Boolean(card)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Card</DialogTitle>
          <DialogDescription>Update card status or remove the card.</DialogDescription>
        </DialogHeader>

        {card && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-background p-4 space-y-1">
              <p className="font-medium text-card-foreground">{card.card.cardHolderName}</p>
              <p className="text-sm text-muted-foreground">
                {card.card.brand.toUpperCase()} •••• {card.card.cardNumber.slice(-4)}
              </p>
              <p className="text-xs text-muted-foreground">Expires {card.card.expiryDate}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</label>
              <Select
                value={selectedStatusId}
                onChange={(e) => setSelectedStatusId(e.target.value)}
                options={statusOptions}
                disabled={!isAdmin || isSaving || isDeleting}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={!isAdmin || isDeleting || isSaving}
          >
            {isDeleting ? 'Deleting…' : 'Delete card'}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isAdmin || isSaving || isDeleting}
          >
            {isSaving ? 'Saving…' : 'Save status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
