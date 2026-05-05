import CardStatusOverview from '@/components/dashboard/CardStatusOverview'
import TotalBalanceWidget from '@/components/dashboard/TotalBalanceWidget'
import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import MoneyFlowPlaceholder from '@/components/dashboard/MoneyFlowPlaceholder'
import PaymentCard from '@/components/payment-card/PaymentCard'
import { buildCardStatusOverviewProps } from '@/mock-data/paymentCardMockData'
import { useDashboardCards } from '@/hooks/useDashboardCards'

// Balance data requires a future transactions endpoint — show placeholders until then.
const BALANCE_PLACEHOLDER = {
  totalBalance: '—',
  currency: 'USD',
  monthlyGrowth: '—',
  monthlyAmount: '—',
}

function CardsSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-48 rounded-2xl bg-muted" />
      <div className="h-4 w-1/2 rounded bg-muted" />
    </div>
  )
}

export default function DashboardPage() {
  const { cards, isLoading, error } = useDashboardCards()

  const primaryCard = cards[0] ?? null
  const cardStatusProps = buildCardStatusOverviewProps(cards)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Welcome back! Here&apos;s your account overview.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-12 xl:gap-5">
        <div className="space-y-4 xl:col-span-8">
          <TotalBalanceWidget
            totalBalance={BALANCE_PLACEHOLDER.totalBalance}
            currency={BALANCE_PLACEHOLDER.currency}
            monthlyGrowth={BALANCE_PLACEHOLDER.monthlyGrowth}
            monthlyAmount={BALANCE_PLACEHOLDER.monthlyAmount}
          />
          <MoneyFlowPlaceholder />
          {isLoading ? (
            <CardsSkeleton />
          ) : error ? (
            <p className="text-sm text-destructive">
              Could not load card data. Please refresh.
            </p>
          ) : (
            <CardStatusOverview {...cardStatusProps} />
          )}
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
            {isLoading ? (
              <div className="animate-pulse h-48 rounded-2xl bg-muted" />
            ) : primaryCard ? (
              <PaymentCard card={primaryCard.card} />
            ) : (
              <p className="text-sm text-muted-foreground">No cards yet.</p>
            )}
          </section>

          <DashboardPlaceholder
            title="Quick Actions"
            description="Transfer, pay bills, and card controls will be placed here in the next ticket."
          />

          <DashboardPlaceholder
            title="Recent Activity"
            description="Latest transactions and alerts placeholder to preserve final dashboard balance."
          />
        </div>
      </section>
    </div>
  )
}
