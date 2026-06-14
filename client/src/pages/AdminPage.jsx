import AdminInsightsPanel from '@/components/admin/AdminInsightsPanel'
import AdminKpiRow from '@/components/admin/AdminKpiRow'
import useAdminPageState from '@/hooks/useAdminPageState'

export default function AdminPage() {
  const { kpiTotals, isLoading, error } = useAdminPageState()

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

      <AdminInsightsPanel />
    </div>
  )
}
