import TotalBalanceWidget from '@/components/dashboard/TotalBalanceWidget'
import CardStatusOverview from '@/components/dashboard/CardStatusOverview'
import PaymentCard from '@/components/payment-card/PaymentCard'
import { dashboardMockData } from '@/mock-data/dashboardMockData'
import {
  buildCardStatusOverviewProps,
  paymentCardMockData,
} from '@/mock-data/paymentCardMockData'

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
          <CardStatusOverview {...buildCardStatusOverviewProps(paymentCardMockData)} />
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

function DashboardPlaceholder({ title, description }) {
  return (
    <section className="rounded-2xl border border-dashed border-border/70 bg-card/70 p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-card-foreground sm:text-lg">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </section>
  )
}