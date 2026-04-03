import CardStatusOverview from '@/components/dashboard/CardStatusOverview'

const mockCardData = {
  totalCards: 3,
  statusCounts: {
    active: 1,
    blocked: 1,
    reported: 1,
  },
}

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
        totalCards={mockCardData.totalCards}
        statusCounts={mockCardData.statusCounts}
      />
    </div>
  )
}
