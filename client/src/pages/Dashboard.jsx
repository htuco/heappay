import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { CreditCard, Plus } from 'lucide-react'
import CardStatusOverview from '@/components/dashboard/CardStatusOverview'
import TotalBalanceWidget from '@/components/dashboard/TotalBalanceWidget'
import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import MoneyFlowPlaceholder from '@/components/dashboard/MoneyFlowPlaceholder'
import QuickActions from '@/components/dashboard/QuickActions'
import DashboardLoadingOverlay from '@/components/dashboard/DashboardLoadingOverlay'
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

function PaymentCardEmpty() {
  return (
    <div className="group relative aspect-[1.58/1] w-full min-w-0 overflow-hidden rounded-3xl border-2 border-dashed border-primary/30 bg-linear-to-br from-primary/5 via-card to-primary/10 p-5 sm:p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5">
      <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl transition-opacity duration-300 group-hover:opacity-70" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 h-36 w-36 rounded-full bg-primary-light/15 blur-3xl" />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 12px)',
        }}
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
        <span className="relative flex items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/20 opacity-75" />
          <span className="relative rounded-2xl bg-linear-to-br from-primary to-primary-light p-3.5 text-primary-foreground shadow-lg shadow-primary/30">
            <CreditCard className="h-6 w-6" strokeWidth={2} />
          </span>
        </span>

        <p className="mt-4 text-base font-semibold text-card-foreground">No cards yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add your first card to get started
        </p>

        <Link
          to="/wallet"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-primary to-primary-light px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-all duration-200 hover:shadow-lg hover:shadow-primary/40 hover:-translate-y-0.5"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Add Card
        </Link>
      </div>
    </div>
  )
}

function PaymentCardError() {
  return (
    <div className="relative aspect-[1.58/1] w-full min-w-0 overflow-hidden rounded-3xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5 md:p-6 flex flex-col items-center justify-center text-center">
      <p className="text-sm font-medium text-destructive">Could not load card</p>
      <p className="mt-1 text-xs text-muted-foreground">Please refresh the page</p>
    </div>
  )
}

const MIN_LOADER_MS = 1500

export default function DashboardPage() {
  const { cards, isLoading, error } = useDashboardCards()
  const [minDelayElapsed, setMinDelayElapsed] = useState(false)
  const primaryCard = cards[0] ?? null
  const cardStatusProps = buildCardStatusOverviewProps(cards)

  useEffect(() => {
    const t = setTimeout(() => setMinDelayElapsed(true), MIN_LOADER_MS)
    return () => clearTimeout(t)
  }, [])

  const showLoader = isLoading || !minDelayElapsed

  return (
    <div className="space-y-6">
      {showLoader && <DashboardLoadingOverlay />}
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
          ) : error ? (
            <PaymentCardError />
          ) : primaryCard ? (
            <PaymentCard card={primaryCard.card} />
          ) : (
            <PaymentCardEmpty />
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
