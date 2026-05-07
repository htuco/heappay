import { useState } from 'react'
import { ArrowUpRight, Eye, EyeOff, TrendingUp } from 'lucide-react'

export default function TotalBalanceWidget({
  totalBalance = '$12,450.00',
  currency = 'USD',
  monthlyGrowth = '+12.5%',
  monthlyAmount = '$2,756.43',
}) {
  const [isBalanceVisible, setIsBalanceVisible] = useState(true)
  const visibleBalance = isBalanceVisible ? totalBalance : '••••••••'

  return (
    <section className="balance-shine relative flex h-full w-full flex-col justify-between overflow-hidden rounded-3xl bg-linear-to-br from-primary-light via-primary to-primary-dark p-7 text-white shadow-lg">
      <div className="pointer-events-none absolute -top-24 right-0 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="shrink-0 rounded-xl border border-white/20 bg-white/10 p-2.5 backdrop-blur">
            <TrendingUp className="h-4 w-4" strokeWidth={2} />
          </span>
          <p className="text-sm font-medium text-white/90">Total Balance</p>
        </div>
        <button
          type="button"
          className="cursor-pointer rounded-full border border-white/20 bg-white/10 p-2 text-white/80 transition hover:text-white"
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

      <div className="relative z-10 mt-6">
        <p className="tabular text-4xl font-bold tracking-tight leading-none text-white sm:text-5xl md:text-6xl">
          {visibleBalance}
        </p>
        <p className="mt-3 text-sm font-medium text-white/80">{currency}</p>
      </div>

      <hr className="relative z-10 mt-6 mb-5 border-white/25" />

      <div className="relative z-10 flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-3 py-2 backdrop-blur">
          <ArrowUpRight className="h-4 w-4 text-white" strokeWidth={2.5} />
          <span className="tabular font-semibold text-white">{monthlyGrowth}</span>
        </div>

        <span className="hidden h-8 w-px shrink-0 bg-white/25 sm:block" aria-hidden />

        <div className="min-w-0">
          <p className="text-xs text-white/80">This month</p>
          <p className="tabular font-semibold tracking-tight">{monthlyAmount}</p>
        </div>
      </div>
    </section>
  )
}
