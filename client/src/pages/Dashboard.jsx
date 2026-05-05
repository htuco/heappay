import CardStatusOverview from '@/components/dashboard/CardStatusOverview'
import TotalBalanceWidget from '@/components/dashboard/TotalBalanceWidget'
import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import MoneyFlowPlaceholder from '@/components/dashboard/MoneyFlowPlaceholder'
import PaymentCard from '@/components/payment-card/PaymentCard'
import { useDashboardCards } from '@/hooks/useDashboardCards'
import { buildCardStatusOverviewProps } from '@/utils/cardStatusOverview'

//  placeholders.
const BALANCE_PLACEHOLDER = {
  totalBalance: '—',
  currency: 'USD',
  monthlyGrowth: '—',
  monthlyAmount: '—',
}

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

function CardStatusSkeleton() {
  return (
    <div className="animate-pulse grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 rounded-2xl bg-muted" />
      ))}
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
            <CardStatusSkeleton />
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
              <PaymentCardSkeleton />
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
