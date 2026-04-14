import CardStatusOverview from '@/components/dashboard/CardStatusOverview'
import TotalBalanceWidget from '@/components/dashboard/TotalBalanceWidget'
import { cardStatusMockData } from '@/mock-data/cardStatusMockData'
import { dashboardMockData } from '@/mock-data/dashboardMockData'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Welcome back! Here&apos;s your account overview.
        </p>
      </header>

      <section className="grid gap-4">
        <TotalBalanceWidget
          totalBalance={dashboardMockData.balance.totalBalance}
          currency={dashboardMockData.balance.currency}
          monthlyGrowth={dashboardMockData.balance.monthlyGrowth}
          monthlyAmount={dashboardMockData.balance.monthlyAmount}
        />

        <CardStatusOverview
          title={cardStatusMockData.title}
          totalCards={cardStatusMockData.totalCards}
          statuses={cardStatusMockData.statuses}
          statusCounts={cardStatusMockData.statusCounts}
        />
      </section>
    </div>
  )
}
