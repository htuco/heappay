import AdminTransactionsPanel from '@/components/admin/AdminTransactionsPanel'
import { useTransactionFilterParams } from '@/hooks/useTransactionFilterParams'

export default function AdminTransactionsPage() {
  const { filters, setFilters, clearFilters, hasActiveFilters } = useTransactionFilterParams()

  return (
    <div className="space-y-6">
      <AdminTransactionsPanel
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />
    </div>
  )
}
