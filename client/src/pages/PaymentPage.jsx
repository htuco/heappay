import { useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import MakePaymentDialog from '@/components/payments/MakePaymentDialog'
import TransactionDetailPanel from '@/components/payments/TransactionDetailPanel'
import TransactionHistoryPanel from '@/components/payments/TransactionHistoryPanel'
import { useTransactions } from '@/hooks/useTransactions'

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
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [makePaymentOpen, setMakePaymentOpen] = useState(false)

  const {
    transactions,
    page,
    totalPages,
    isLoading,
    error,
    setPage,
  } = useTransactions()

  const selectedTransactionId = selectedTransaction?.transaction_id ?? selectedTransaction?.id ?? null
  const testTransaction = useMemo(() => transactions[0] ?? TEST_TRANSACTION, [transactions])

  function handleSelectTransaction(transaction) {
    setSelectedTransaction(transaction)
  }

  function handleOpenTestDetail() {
    setSelectedTransaction(testTransaction)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground">Review payment activity and inspect transaction details.</p>
        </div>
        <Button variant="outline" onClick={handleOpenTestDetail}>
          <Eye />
          Test detail view
        </Button>
      </div>

      <TransactionHistoryPanel
        transactions={transactions}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        selectedTransactionId={selectedTransactionId}
        onSelectTransaction={handleSelectTransaction}
        onMakePayment={() => setMakePaymentOpen(true)}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        isLoading={isLoading}
        error={error}
      />

      <TransactionDetailPanel
        open={Boolean(selectedTransaction)}
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />

      <MakePaymentDialog
        open={makePaymentOpen}
        onClose={() => setMakePaymentOpen(false)}
      />
    </div>
  )
}
