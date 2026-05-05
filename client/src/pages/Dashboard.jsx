import CardStatusOverview from '@/components/dashboard/CardStatusOverview'
import TotalBalanceWidget from '@/components/dashboard/TotalBalanceWidget'
import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import MoneyFlowPlaceholder from '@/components/dashboard/MoneyFlowPlaceholder'
import QuickActions from '@/components/dashboard/QuickActions'
import PaymentCard from '@/components/payment-card/PaymentCard'
import { dashboardMockData } from '@/mock-data/dashboardMockData'
import { useDashboardCards } from '@/hooks/useDashboardCards'
import { buildCardStatusOverviewProps } from '@/utils/cardStatusOverview'

function PaymentCardSkeleton() {
  return (
    <div className="animate-pulse relative aspect-[1.58/1] min-h-[210px] w-full min-w-0 overflow-hidden rounded-3xl bg-muted p-4 sm:p-5 md:p-6 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="h-3 w-20 rounded bg-muted-foreground/20" />
        <div className="h-8 w-14 rounded-lg bg-muted-foreground/20" />
      </div>
      <div className="mt-auto space-y-3 pb-2">
        <div className="h-5 w-40 rounded bg-muted-foreground/20" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="h-2 w-12 rounded bg-muted-foreground/15" />
            <div className="h-3 w-24 rounded bg-muted-foreground/20" />
          </div>
          <div className="space-y-1 text-right">
            <div className="h-2 w-10 rounded bg-muted-foreground/15 ml-auto" />
            <div className="h-3 w-12 rounded bg-muted-foreground/20 ml-auto" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { cards, isLoading, error } = useDashboardCards()
  const primaryCard = cards[0] ?? null
  const cardStatusProps = buildCardStatusOverviewProps(cards)

  return (
    <div className="space-y-6">
      {/* Row 1: Balance (2/3) + Payment Card (1/3) */}
      <section className="grid items-stretch gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TotalBalanceWidget
            totalBalance={dashboardMockData.balance.totalBalance}
            todaysChange={dashboardMockData.balance.todaysChange}
          />
        </div>
        <div className="flex h-full items-center justify-center">
          {isLoading ? (
            <PaymentCardSkeleton />
          ) : primaryCard ? (
            <PaymentCard card={primaryCard.card} />
          ) : (
            <PaymentCardSkeleton />
          )}
        </div>
      </section>

      {/* Row 2: Money Flow (2/3) + Quick Actions (1/3) */}
      <section className="grid items-stretch gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MoneyFlowPlaceholder
            points={dashboardMockData.moneyFlow.points}
            labels={dashboardMockData.moneyFlow.labels}
          />
        </div>
        <QuickActions />
      </section>

      {/* Row 3: Card Status (1/3) + Recent Activity (2/3) */}
      <section className="grid items-stretch gap-5 xl:grid-cols-3">
        {error ? (
          <section className="flex h-full flex-col rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <p className="text-sm text-destructive">
              Could not load card data. Please refresh.
            </p>
          </section>
        ) : (
          <CardStatusOverview {...cardStatusProps} />
        )}
        <div className="xl:col-span-2">
          <DashboardPlaceholder
            title="Recent Activity"
            items={dashboardMockData.recentActivity}
          />
        </div>
      </section>
    </div>
  )
}
