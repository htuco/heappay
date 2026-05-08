import { ArrowLeftRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'

const TYPE_LABEL = { 1: 'Deposit', 2: 'Payment', 3: 'Refund', 4: 'Withdrawal', 5: 'Chargeback' }
const TYPE_VARIANT = { 1: 'success', 2: 'default', 3: 'info', 4: 'warning', 5: 'error' }
const STATUS_LABEL = { 1: 'Pending', 2: 'Completed', 3: 'Failed', 4: 'Reversed' }
const STATUS_VARIANT = { 1: 'warning', 2: 'success', 3: 'error', 4: 'secondary' }

function formatAmount(amount) {
  const num = parseFloat(amount ?? '0')
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function DetailRow({ label, children }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function DetailContent({ transaction }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DetailRow label="Amount">
        <p className="text-xl font-bold text-card-foreground">{formatAmount(transaction.amount)}</p>
      </DetailRow>

      <DetailRow label="Date">
        <p className="font-medium text-card-foreground">{formatDate(transaction.created_at)}</p>
      </DetailRow>

      <DetailRow label="Type">
        <Badge variant={TYPE_VARIANT[transaction.transaction_type_id] ?? 'secondary'}>
          {TYPE_LABEL[transaction.transaction_type_id] ?? `Type ${transaction.transaction_type_id}`}
        </Badge>
      </DetailRow>

      <DetailRow label="Status">
        <Badge variant={STATUS_VARIANT[transaction.status_id] ?? 'secondary'}>
          {STATUS_LABEL[transaction.status_id] ?? `Status ${transaction.status_id}`}
        </Badge>
      </DetailRow>

      <DetailRow label="From Card">
        <p className="font-medium text-card-foreground">
          {transaction.sender_card_id ? `Card #${transaction.sender_card_id}` : '—'}
        </p>
      </DetailRow>

      <DetailRow label="To Card">
        <p className="font-medium text-card-foreground">Card #{transaction.recipient_card_id}</p>
      </DetailRow>

      {transaction.note && (
        <div className="sm:col-span-2">
          <DetailRow label="Note">
            <p className="font-medium text-card-foreground">{transaction.note}</p>
          </DetailRow>
        </div>
      )}

      <DetailRow label="Transaction ID">
        <p className="font-mono text-xs text-muted-foreground">#{transaction.transaction_id}</p>
      </DetailRow>
    </div>
  )
}

function Placeholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="rounded-2xl bg-muted/60 p-4">
        <ArrowLeftRight className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="font-medium text-card-foreground">No transaction selected</p>
      <p className="text-sm text-muted-foreground">Click a row to view details.</p>
    </div>
  )
}

export default function TransactionDetailPanel({ transaction, onClose, isMobile = false }) {
  if (isMobile) {
    return (
      <DialogRoot open={Boolean(transaction)} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              {transaction ? formatDate(transaction.created_at) : ''}
            </DialogDescription>
          </DialogHeader>
          {transaction && <DetailContent transaction={transaction} />}
        </DialogContent>
      </DialogRoot>
    )
  }

  return (
    <article className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 xl:col-span-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-card-foreground">Transaction Details</h2>
        <p className="text-xs text-muted-foreground">Select a transaction to view details</p>
      </div>

      {transaction ? <DetailContent transaction={transaction} /> : <Placeholder />}
    </article>
  )
}
