import CardStatusOverview from '@/components/dashboard/CardStatusOverview'
import { cardStatusMockData } from '@/mock-data/cardStatusMockData'
import TotalBalanceWidget from '@/components/dashboard/TotalBalanceWidget'
import { dashboardMockData } from '@/mock-data/dashboardMockData'
import { paymentCardMockData } from '@/mock-data/paymentCardMockData'
import PaymentCard from '@/components/payment-card/PaymentCard'

function DashboardPlaceholder({ title, description, ctaLabel = "Coming soon" }) {
  return (
    <section className="rounded-3xl border border-dashed border-border bg-card/70 p-4 shadow-sm sm:p-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Placeholder
        </p>
        <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-4 inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
        {ctaLabel}
      </div>
    </section>
  )
}

function MoneyFlowPlaceholder() {
  const mockBars = [42, 28, 63, 54, 77, 49, 68]

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
    <header className="mb-4 flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Insights
          </p>
          <h2 className="text-base font-semibold text-card-foreground sm:text-lg">
            Money Flow (Placeholder)
          </h2>
        </div>
        <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
          Weekly trend
        </span>
      </header>

      <div className="rounded-2xl border border-dashed border-border/80 bg-background/70 p-4">
        <div className="flex h-36 items-end gap-2 sm:gap-3">
          {mockBars.map((bar, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-md bg-primary/75"
                style={{ height: `${bar}%` }}
              />
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Placeholder chart for upcoming money flow and transaction trend widget.
        </p>
      </div>
    </section>
  )
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Welcome back! Here&apos;s your account overview.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-12 xl:gap-5">
        <div className="xl:col-span-8">
          <TotalBalanceWidget
            totalBalance={dashboardMockData.balance.totalBalance}
            currency={dashboardMockData.balance.currency}
            monthlyGrowth={dashboardMockData.balance.monthlyGrowth}
            monthlyAmount={dashboardMockData.balance.monthlyAmount}
          />
        </div>

        <div className="space-y-4 xl:col-span-4">
          <section className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <header className="mb-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Main Card
              </p>
              <h2 className="text-base font-semibold text-card-foreground sm:text-lg">
                Primary payment method
              </h2>
            </header>
            <PaymentCard card={paymentCardMockData[0]?.card} />
          </section>

          <DashboardPlaceholder
            title="Quick Actions"
            description="Transfer, pay bills, and card controls will be placed here in the next ticket."
          />
        </div>

        <div className="xl:col-span-8">
          <CardStatusOverview
            title={cardStatusMockData.title}
            totalCards={cardStatusMockData.totalCards}
            statuses={cardStatusMockData.statuses}
            statusCounts={cardStatusMockData.statusCounts}
          />
        </div>

        <div className="xl:col-span-4">
          <DashboardPlaceholder
            title="Recent Activity"
            description="Latest transactions and alerts placeholder to preserve final dashboard balance."
          />
        </div>
      </section>
    </div>
  )
}