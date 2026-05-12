import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TransactionDetailPanel from '@/components/payment/TransactionDetailPanel'

const TEST_TRANSACTION = {
  transaction_id: 1,
  sender_card_id: 1001,
  recipient_card_id: 2002,
  transaction_type_id: 2,
  status_id: 2,
  amount: '1500.00',
  fee: '0.00',
  note: 'Temporary detail preview until transaction history is merged.',
  created_at: new Date().toISOString(),
}

export default function PaymentPage() {
  const [selectedTransaction, setSelectedTransaction] = useState(null)

  function handleOpenTestDetail() {
    setSelectedTransaction(TEST_TRANSACTION)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Temporary placeholder for opening the payment detail modal.
          </p>
        </div>
        <Button variant="outline" onClick={handleOpenTestDetail}>
          <Eye />
          Test detail view
        </Button>
      </div>

      <TransactionDetailPanel
        open={Boolean(selectedTransaction)}
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </div>
  )
}
