import { useState } from 'react'
import { ArrowUpRight, Eye, TrendingUp } from 'lucide-react'

export default function TotalBalanceWidget({
  totalBalance = '$12,450.00',
  currency = 'USD',
  monthlyGrowth = '+12.5%',
  monthlyAmount = '$2,756.43',
}) {
  const [isBalanceVisible, setIsBalanceVisible] = useState(true)
  const visibleBalance = isBalanceVisible ? totalBalance : '••••••••'

  return (
    <section className="relative w-full max-w-full min-w-0 overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-700 p-6 text-white shadow-xl sm:p-8">
      <div className="pointer-events-none absolute -top-20 right-0 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl" />

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-xl border border-white/20 bg-white/10 p-2.5 backdrop-blur">
            <TrendingUp className="h-4 w-4" />
          </span>
          <p className="truncate text-sm font-medium text-white/90">Total Balance</p>
        </div>
        <button
          type="button"
          className="cursor-pointer rounded-full border border-white/20 bg-white/10 p-2 text-white/80 transition hover:text-white"
          onClick={() => setIsBalanceVisible((prev) => !prev)}
          aria-label="Toggle balance visibility"
          aria-pressed={!isBalanceVisible}
        >
          <Eye className="h-4 w-4" />
        </button>
      </div>

      <h2 className="relative z-10 mt-8 mb-7 break-words text-4xl font-bold tracking-tight sm:text-5xl md:text-[3.35rem]">
        {visibleBalance}
      </h2>
      <p className="relative z-10 -mt-4 mb-6 text-sm font-medium text-white/80">{currency}</p>

      <hr className="mb-6 border-white/25" />

      <div className="relative z-10 flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur">
          <ArrowUpRight className="h-4 w-4 text-green-300" />
          <span className="font-semibold text-green-300">{monthlyGrowth}</span>
        </div>

        <span
          className="hidden h-8 w-px shrink-0 bg-white/25 sm:block"
          aria-hidden
        />

        <div className="min-w-0">
          <p className="text-xs text-white/80">This month</p>
          <p className="font-semibold tracking-tight">{monthlyAmount}</p>
        </div>
      </div>
    </section>
  )
}
