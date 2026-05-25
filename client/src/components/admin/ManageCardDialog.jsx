import { useState } from 'react'
import { Calendar, CreditCard, Mail, Save, ShieldCheck, Trash2, User } from 'lucide-react'

import PaymentCard from '@/components/payment-card/PaymentCard'
import { Badge } from '@/components/ui/badge'
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
import { getCardStatus, getStatusBadgeVariant } from '@/utils/admin.utils'

function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-background/70 p-3">
      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-card-foreground">{value || 'Not available'}</p>
      </div>
    </div>
  )
}

export default function ManageCardDialog({ card, onClose, onUpdate, onDelete, isAdmin, cardStatuses }) {
  return (
    <DialogRoot open={Boolean(card)} onOpenChange={(open) => !open && onClose()}>
      {card && (
        <ManageCardDialogBody
          key={card.id}
          card={card}
          onUpdate={onUpdate}
          onDelete={onDelete}
          isAdmin={isAdmin}
          cardStatuses={cardStatuses}
        />
      )}
    </DialogRoot>
  )
}

function ManageCardDialogBody({ card, onUpdate, onDelete, isAdmin, cardStatuses }) {
  const [selectedStatusId, setSelectedStatusId] = useState(String(card.statusId ?? ''))
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

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
  const cardStatus = card ? getCardStatus(card.card) : ''
  const hasStatusChanged = card ? selectedStatusId !== String(card.statusId ?? '') : false
  const previewCard = card
    ? {
        ...card.card,
        status: cardStatus,
      }
    : null

  return (
    <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
      <DialogHeader className="mb-0 border-b border-border px-5 py-5 pr-14 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <DialogTitle>Manage Card</DialogTitle>
            <DialogDescription>Review card details and update its availability.</DialogDescription>
          </div>
          <Badge variant={getStatusBadgeVariant(cardStatus)} className="capitalize">
            {cardStatus}
          </Badge>
        </div>
      </DialogHeader>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)]">
        <section className="border-b border-border bg-muted/30 px-5 py-6 sm:px-6 lg:border-b-0 lg:border-r">
          <div className="manage-card-preview mx-auto max-w-sm rounded-panel border border-border bg-background p-4 shadow-sm">
            <PaymentCard card={previewCard} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <DetailRow icon={<User className="size-4" />} label="Cardholder" value={card.card.cardHolderName} />
            <DetailRow
              icon={<CreditCard className="size-4" />}
              label="Card"
              value={`${card.card.brand.toUpperCase()} ending ${card.card.cardNumber.slice(-4)}`}
            />
            <DetailRow icon={<Calendar className="size-4" />} label="Expiration" value={card.card.expiryDate} />
            <DetailRow icon={<Mail className="size-4" />} label="Owner email" value={card.ownerEmail} />
          </div>
        </section>

        <section className="flex flex-col px-5 py-6 sm:px-6">
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">Card status</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose the state customers and internal tools should see for this card.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <label htmlFor="manage-card-status" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </label>
              <Select
                id="manage-card-status"
                value={selectedStatusId}
                onChange={(e) => setSelectedStatusId(e.target.value)}
                options={statusOptions}
                disabled={!isAdmin || isSaving || isDeleting}
                className="h-11"
              />
            </div>

            {!isAdmin && (
              <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Admin access is required to change card status or delete this card.
              </p>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/25 p-4">
            <p className="text-sm font-semibold text-card-foreground">Before saving</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Status changes apply immediately after saving. Deleting removes the card from the admin card list.
            </p>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </section>
      </div>

      <DialogFooter className="mt-0 flex-col-reverse border-t border-border px-5 py-4 sm:flex-row sm:px-6">
        <Button
          variant="destructive"
          size="lg"
          onClick={handleDelete}
          disabled={!isAdmin || isDeleting || isSaving}
          className="w-full sm:w-auto"
        >
          <Trash2 className="size-4" />
          {isDeleting ? 'Deleting...' : 'Delete card'}
        </Button>
        <Button
          size="lg"
          onClick={handleSave}
          disabled={!isAdmin || isSaving || isDeleting || !hasStatusChanged || !selectedStatusId}
          className="w-full sm:w-auto"
        >
          <Save className="size-4" />
          {isSaving ? 'Saving...' : 'Save status'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
