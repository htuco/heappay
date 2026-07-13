import AdminInsightsPanel from '@/components/admin/AdminInsightsPanel'
import AdminKpiRow from '@/components/admin/AdminKpiRow'
import AdminTransactionFilters from '@/components/admin/AdminTransactionFilters'
import useAdminPageState from '@/hooks/useAdminPageState'
import { useTransactionFilterParams } from '@/hooks/useTransactionFilterParams'

export default function AdminPage() {
  const { kpiTotals, isLoading, error } = useAdminPageState()
  const { filters, setFilters, clearFilters, hasActiveFilters } = useTransactionFilterParams({
    includeSort: false,
  })

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-destructive">
          Failed to load admin data. Please refresh the page.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AdminKpiRow kpiTotals={kpiTotals} isLoading={isLoading} />

      <div className="rounded-panel border border-border bg-card px-4 py-3 shadow-sm sm:px-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Transaction filters
        </p>
        <AdminTransactionFilters
          filters={filters}
          onChange={setFilters}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
          showSort={false}
        />
      </div>

      <AdminInsightsPanel filters={filters} />
    </div>
  )
}
