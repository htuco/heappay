import { useState } from 'react'

import TransactionDetailPanel from '@/components/payment/TransactionDetailPanel'
import TransactionHistory from '@/components/payment/TransactionHistory'

export default function PaymentPage() {
  const [selectedTransaction, setSelectedTransaction] = useState(null)

  return (
    <div className="space-y-6">
      <TransactionHistory onTransactionSelect={setSelectedTransaction} />
      <TransactionDetailPanel
        open={Boolean(selectedTransaction)}
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </div>
  )
}
