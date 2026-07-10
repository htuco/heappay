import { useState } from 'react'
import { ArrowUpRight, CreditCard, Eye, EyeOff, HelpCircle, TrendingUp, Wallet } from 'lucide-react'

function ReservedHelp() {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        className="ml-1 inline-flex size-4 items-center justify-center rounded-full text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        aria-label="What is reserved balance?"
      >
        <HelpCircle className="size-3.5" strokeWidth={2} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-input bg-slate-900 px-3 py-2 text-left text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        Reserved is money held for transactions you&apos;ve sent that haven&apos;t
        completed yet. It&apos;s already been deducted from your balance and will be
        released back if the transfer is returned.
      </span>
    </span>
  )
}

export default function TotalBalanceWidget({
  totalBalance = '$0.00',
  walletBalance = null,
  cardsBalance = null,
  reservedBalance = null,
  hasReserved = false,
  currency = 'USD',
  monthlyGrowth = null,
  monthlyAmount = null,
  isLoading = false,
  noMainCardCta,
}) {
  const hasBreakdown = walletBalance != null && cardsBalance != null
  const [isBalanceVisible, setIsBalanceVisible] = useState(true)
  const visibleBalance = isBalanceVisible ? totalBalance : '••••••••'

  return (
    <section className="balance-shine relative flex h-full w-full flex-col justify-between overflow-hidden rounded-panel bg-linear-to-br from-primary-light via-primary to-primary-dark p-5 sm:p-7 lg:p-6 xl:p-7 text-white shadow-lg">
      <div className="pointer-events-none absolute -top-24 right-0 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="shrink-0 rounded-input border border-white/20 bg-white/10 p-2.5 backdrop-blur">
            <TrendingUp className="h-4 w-4" strokeWidth={2} />
          </span>
          <p className="text-sm font-medium text-white/90">Total Balance</p>
        </div>
        <button
          type="button"
          className="flex h-11 w-11 md:h-auto md:w-auto cursor-pointer items-center justify-center rounded-input border border-white/20 bg-white/10 md:p-2 text-white/80 transition touch-manipulation hover:text-white"
          onClick={() => setIsBalanceVisible((prev) => !prev)}
          aria-label="Toggle balance visibility"
          aria-pressed={!isBalanceVisible}
        >
          {isBalanceVisible ? (
            <Eye className="h-4 w-4" strokeWidth={2} />
          ) : (
            <EyeOff className="h-4 w-4" strokeWidth={2} />
          )}
        </button>
      </div>

      <div className="relative z-10 mt-6 lg:mt-4 xl:mt-6">
        {isLoading ? (
          <div className="space-y-2">
            <div className="shimmer h-3 w-24 rounded-full" />
            <div className="shimmer h-10 w-40 rounded-input" />
          </div>
        ) : (
          <>
            <p className="tabular text-4xl font-bold tracking-tight leading-none text-white sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl">
              {visibleBalance}
            </p>
            <p className="mt-3 lg:mt-2 xl:mt-3 text-sm font-medium text-white/80">
              {currency}
              {hasReserved ? (
                <span className="tabular font-normal text-white/60">
                  {' · '}
                  {isBalanceVisible ? reservedBalance : '••••'}
                  {' reserved'}
                  <ReservedHelp />
                </span>
              ) : null}
            </p>
            {hasBreakdown ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-input border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
                  <Wallet className="h-3.5 w-3.5" strokeWidth={2} />
                  Wallet
                  <span className="tabular font-semibold text-white">
                    {isBalanceVisible ? walletBalance : '••••'}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-input border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
                  <CreditCard className="h-3.5 w-3.5" strokeWidth={2} />
                  On cards
                  <span className="tabular font-semibold text-white">
                    {isBalanceVisible ? cardsBalance : '••••'}
                  </span>
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>

      <hr className="relative z-10 mt-6 mb-5 lg:mt-4 lg:mb-4 xl:mt-6 xl:mb-5 border-white/25" />

      <div className="relative z-10 flex flex-wrap items-center gap-4 sm:gap-6">
        {!isLoading && noMainCardCta ? (
          <div className="ml-auto">{noMainCardCta}</div>
        ) : null}

        {isLoading ? (
          <div className="shimmer h-8 w-20 rounded-input" />
        ) : monthlyGrowth != null ? (
          <div className="flex items-center gap-2 rounded-input border border-white/20 bg-white/15 px-3 py-2 backdrop-blur">
            <ArrowUpRight className="h-4 w-4 text-white" strokeWidth={2.5} />
            <span className="tabular font-semibold text-white">{monthlyGrowth}</span>
          </div>
        ) : null}

        {!isLoading && monthlyGrowth != null && (
          <span className="hidden h-8 w-px shrink-0 bg-white/25 sm:block" aria-hidden />
        )}

        {isLoading ? (
          <div className="space-y-1">
            <div className="shimmer h-2 w-16 rounded-full" />
            <div className="shimmer h-4 w-24 rounded" />
          </div>
        ) : monthlyAmount != null ? (
          <div className="min-w-0">
            <p className="text-xs text-white/80">This month</p>
            <p className="tabular font-semibold tracking-tight">{monthlyAmount}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
