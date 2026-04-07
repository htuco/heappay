import CardStatusOverview from '@/components/dashboard/CardStatusOverview'
import { cardStatusMockData } from '@/mocks/cardStatusMockData'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Quick snapshot of your current card portfolio.
        </p>
      </header>
      <CardStatusOverview
        title={cardStatusMockData.title}
        totalCards={cardStatusMockData.totalCards}
        statuses={cardStatusMockData.statuses}
        statusCounts={cardStatusMockData.statusCounts}
      />
    </div>
  )
}
