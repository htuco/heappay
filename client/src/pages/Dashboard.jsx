import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { CreditCard, Plus } from 'lucide-react'
import CardStatusOverview from '@/components/dashboard/CardStatusOverview'
import TotalBalanceWidget from '@/components/dashboard/TotalBalanceWidget'
import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import MoneyFlowPlaceholder from '@/components/dashboard/MoneyFlowPlaceholder'
import QuickActions from '@/components/dashboard/QuickActions'
import DashboardLoadingOverlay from '@/components/dashboard/DashboardLoadingOverlay'
import PaymentCard from '@/components/payment-card/PaymentCard'
import PaymentWizard from '@/components/payment/PaymentWizard'
import TopUpModal from '@/components/payment/TopUpModal'
import AddCardModal from '@/components/AddCardModal'
import { useWalletCards } from '@/hooks/useWalletCards'
import { useAuth } from '@/hooks/useAuth'
import { useDashboardCards } from '@/hooks/useDashboardCards'
import { useTotalBalance } from '@/hooks/useTotalBalance'
import { useTransactionSummary } from '@/hooks/useTransactionSummary'
import { useTransactions } from '@/hooks/useTransactions'
import transactionTypesService from '@/services/transactionTypesService'
import { buildCardStatusOverviewProps } from '@/utils/cardStatusOverview'
import {
  buildCardLastFourMapFromDashboardCards,
  buildUserCardIdSet,
} from '@/utils/dashboardRecentActivity'

function PaymentCardSkeleton() {
  return (
    <div className="animate-pulse relative aspect-[1.58/1] min-h-[210px] w-full min-w-0 overflow-hidden rounded-panel bg-muted p-4 sm:p-5 md:p-6 flex flex-col max-w-[464px]">
      <div className="flex items-start justify-between gap-3">
        <div className="h-3 w-20 rounded bg-muted-foreground/20" />
        <div className="h-8 w-14 rounded-input bg-muted-foreground/20" />
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
    <div className="group relative aspect-[1.58/1] w-full min-w-0 overflow-hidden rounded-panel border-2 border-dashed border-primary/30 bg-linear-to-br from-primary/5 via-card to-primary/10 p-5 sm:p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 max-w-[464px]">
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
          <span className="absolute inset-0 animate-ping rounded-surface bg-primary/20 opacity-75" />
          <span className="relative rounded-surface bg-linear-to-br from-primary to-primary-light p-3.5 text-primary-foreground shadow-lg shadow-primary/30">
            <CreditCard className="h-6 w-6" strokeWidth={2} />
          </span>
        </span>

        <p className="mt-4 text-base font-semibold text-card-foreground">No cards yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add your first card to get started
        </p>

        <Link
          to="/wallet"
          className="mt-4 inline-flex items-center gap-1.5 rounded-input bg-linear-to-r from-primary to-primary-light px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-all duration-200 hover:shadow-lg hover:shadow-primary/40 hover:-translate-y-0.5"
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
    <div className="relative aspect-[1.58/1] w-full min-w-0 overflow-hidden rounded-panel border border-destructive/30 bg-destructive/5 p-4 sm:p-5 md:p-6 flex flex-col items-center justify-center text-center max-w-[464px]">
      <p className="text-sm font-medium text-destructive">Could not load card</p>
      <p className="mt-1 text-xs text-muted-foreground">Please refresh the page</p>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { cards, isLoading, error, refetch } = useDashboardCards()
  const {
    formattedBalance,
    formattedReserved,
    hasReserved,
    isLoading: balanceLoading,
  } = useTotalBalance()
  const {
    chartData,
    isLoading: summaryLoading,
    error: summaryError,
    refresh: refreshSummary,
  } = useTransactionSummary({ months: 6 })
  const {
    transactions: recentTransactions,
    isLoading: recentActivityLoading,
    error: recentActivityError,
  } = useTransactions({ pageSize: 5 })
  const [typeNameById, setTypeNameById] = useState({})
  const [paymentWizardOpen, setPaymentWizardOpen] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [addCardOpen, setAddCardOpen] = useState(false)
  const { addCard, isSaving, saveError } = useWalletCards()
  const mainCard = cards.find((c) => c.isMain) ?? cards[0] ?? null
  const mainCardId = mainCard ? Number(mainCard.id) : null
  const primaryCard = mainCard
  const cardStatusProps = buildCardStatusOverviewProps(cards)

  const lastEntry = chartData[chartData.length - 1]
  const prevEntry = chartData[chartData.length - 2]

  const monthlyAmount = lastEntry
    ? '$' + Math.abs(lastEntry.net).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : undefined

  const monthlyGrowth = (lastEntry && prevEntry && prevEntry.net !== 0)
    ? (() => {
        const pct = ((lastEntry.net - prevEntry.net) / Math.abs(prevEntry.net)) * 100
        return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'
      })()
    : undefined

  useEffect(() => {
    if (!user) {
      return
    }
    let cancelled = false
    transactionTypesService
      .list()
      .then((types) => {
        if (cancelled || !Array.isArray(types)) return
        const map = {}
        for (const t of types) {
          map[t.transaction_type_id] = t.name
        }
        setTypeNameById(map)
      })
      .catch(() => {
        if (!cancelled) setTypeNameById({})
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const activityContext = useMemo(
    () => ({
      currentUserCardIds: buildUserCardIdSet(cards),
      lastFourByCardId: buildCardLastFourMapFromDashboardCards(cards),
      typeNameById: user ? typeNameById : {},
    }),
    [cards, typeNameById, user],
  )

  // useDashboardCards keeps isLoading true for at least MIN_LOADER_MS on page loads.
  // Background refetches pass showLoader: false and do not trigger the overlay.
  const showLoader = Boolean(user?.id) && isLoading

  return (
    <div className="space-y-6">
      {showLoader && <DashboardLoadingOverlay />}
      {/* Row 1: Balance (flexible) + Payment Card (fixed 384px at lg, 464px at xl) */}
      <section className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,29rem)]">
        <div className="min-w-0">
          <TotalBalanceWidget
            totalBalance={formattedBalance}
            reservedBalance={formattedReserved}
            hasReserved={hasReserved}
            monthlyGrowth={monthlyGrowth}
            monthlyAmount={monthlyAmount}
            isLoading={balanceLoading || summaryLoading}
            noMainCardCta={
              !isLoading && cards.length > 0 && !mainCard?.isMain ? (
                <Link
                  to="/wallet"
                  className="text-xs font-medium text-white/80 underline hover:text-white"
                >
                  Set a main card
                </Link>
              ) : undefined
            }
          />
        </div>
        <div className="flex h-full items-center justify-center lg:justify-end">
          {isLoading ? (
            <PaymentCardSkeleton />
          ) : error ? (
            <PaymentCardError />
          ) : primaryCard ? (
            <PaymentCard card={primaryCard.card} className="payment-card-fit max-w-[464px]" />
          ) : (
            <PaymentCardEmpty />
          )}
        </div>
      </section>

      {/* Row 2: Money Flow (flexible) + Quick Actions (fixed 384px at lg, 464px at xl) */}
      <section className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,29rem)]">
        <div className="min-w-0">
          <MoneyFlowPlaceholder
            chartData={chartData}
            isLoading={summaryLoading}
            error={summaryError}
            onRetry={refreshSummary}
          />
        </div>
        <div className="min-w-0">
          <QuickActions
            onSend={() => setPaymentWizardOpen(true)}
            onTopUp={() => setTopUpOpen(true)}
            onAddNew={() => setAddCardOpen(true)}
          />
        </div>
      </section>

      {/* Row 3: Card Status (fixed 384px at lg, 464px at xl) + Recent Activity (flexible) */}
      <section className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,29rem)_minmax(0,1fr)]">
        <div className="min-w-0">
          {error ? (
            <section className="flex h-full flex-col rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6">
              <p className="text-sm text-destructive">
                Could not load card data. Please refresh.
              </p>
            </section>
          ) : (
            <CardStatusOverview {...cardStatusProps} />
          )}
        </div>
        <div className="min-w-0">
          <DashboardPlaceholder
            title="Recent Activity"
            transactions={recentTransactions}
            activityContext={activityContext}
            isLoading={recentActivityLoading}
            error={recentActivityError}
          />
        </div>
      </section>

      <PaymentWizard
        isOpen={paymentWizardOpen}
        onClose={() => setPaymentWizardOpen(false)}
        initialCardId={mainCardId}
      />
      <TopUpModal
        isOpen={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        initialCardId={mainCardId}
      />
      <AddCardModal
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        onSubmit={async (cardInput) => {
          await addCard(cardInput)
          refetch({ showLoader: false })
        }}
        isSubmitting={isSaving}
        submitError={saveError}
      />
    </div>
  )
}
