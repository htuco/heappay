import TotalBalanceWidget from '@/components/dashboard/TotalBalanceWidget'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Welcome back! Here&apos;s your account overview.
        </p>
      </header>

      <TotalBalanceWidget
        totalBalance="$12,450.00"
        monthlyGrowth="+12.5%"
        monthlyAmount="$2,756.43"
      />
    </div>
  )
}
