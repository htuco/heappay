import { useState } from 'react'
import { useTransactions } from '@/hooks/useTransactions'
import TransactionHistoryPanel from '@/components/payments/TransactionHistoryPanel'
import TransactionDetailPanel from '@/components/payments/TransactionDetailPanel'

export default function PaymentPage() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedTransaction, setSelectedTransaction] = useState(null)

  const { transactions, page, totalPages, isLoading, error, setPage } = useTransactions()

  function handleSelectTransaction(txn) {
    setSelectedTransaction((prev) =>
      prev?.transaction_id === txn.transaction_id ? null : txn
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-12">
        <TransactionHistoryPanel
          transactions={transactions}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          selectedTransactionId={selectedTransaction?.transaction_id}
          onSelectTransaction={handleSelectTransaction}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          isLoading={isLoading}
          error={error}
        />

        {/* Desktop detail panel */}
        <div className="hidden xl:block xl:col-span-4">
          <TransactionDetailPanel transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} />
        </div>
      </div>

      {/* Mobile detail dialog */}
      <TransactionDetailPanel
        isMobile
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </div>
  )
}
