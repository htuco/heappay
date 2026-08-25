import { useState } from 'react'
import { CreditCard, Eye, EyeOff, HelpCircle, TrendingUp, Wallet } from 'lucide-react'
import { useBalanceScopePreference } from '@/hooks/useBalanceScopePreference'
import { getBalanceShares } from '@/utils/balanceScope'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'

const MASKED = '••••••••'

// Which slice of the balance the headline is showing. Reserved funds are held
// against cards, so the note is only true of a headline that includes them.
const SCOPES = {
  combined: { label: 'Total Balance', showsReserved: true },
  wallet: { label: 'Wallet Balance', showsReserved: false },
  cards: { label: 'Cards Balance', showsReserved: true },
}

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

/**
 * One side of the breakdown. Doubles as the scope switch: selecting a tile
 * promotes its figure to the headline, selecting the active one returns to the
 * combined total.
 */
function BreakdownTile({ icon, label, value, share, isActive, isMasked, onClick }) {
  // Destructuring as `{ icon: Icon }` reads as an unused arg to this repo's
  // ESLint (no react plugin, so JSX usage isn't tracked) — assign it instead.
  const Icon = icon

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      // A ring, not a thicker border: rings are outside layout, so switching
      // scope can never change the widget's height.
      className={`min-w-0 cursor-pointer rounded-input border border-white/20 p-2.5 text-left backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 xl:p-3 ${
        isActive
          ? 'bg-white/30 ring-2 ring-white/80'
          : 'bg-white/10 hover:bg-white/15'
      }`}
    >
      <span className="flex items-center gap-1.5">
        <Icon className="h-4 w-4 shrink-0 text-white/85" strokeWidth={2} />
        <span className="truncate text-sm font-medium text-white/85">{label}</span>
        <span className="tabular ml-auto shrink-0 text-xs font-medium text-white/70">
          {Math.round(share)}%
        </span>
      </span>

      {/* Held at text-sm below xl on purpose: the lg column leaves each tile
          ~106px of inner width, which a seven-figure balance already fills. */}
      <span className="tabular mt-1 block truncate text-sm font-bold tracking-tight text-white xl:text-xl">
        {isMasked ? '••••' : value}
      </span>

      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/20">
        <span
          className="block h-full rounded-full bg-white/90 transition-[width] duration-500"
          style={{ width: `${Math.max(0, Math.min(100, share))}%` }}
        />
      </span>
    </button>
  )
}

/**
 * Takes raw numbers and formats them itself.
 *
 * It used to receive pre-formatted strings *and* the same figures again as raw
 * numbers, which meant the currency was decided by whichever caller built the
 * strings. Formatting here — through the shared display-currency helper — is
 * what makes switching currency a change in one place.
 */
export default function TotalBalanceWidget({
  totalBalance = 0,
  walletBalance = null,
  cardsBalance = null,
  reservedBalance = null,
  hasReserved = false,
  monthlyGrowth = null,
  monthlyAmount = null,
  isLoading = false,
  noMainCardCta,
}) {
  const { formatMoney, currency } = useDisplayCurrency()
  const hasBreakdown = walletBalance != null && cardsBalance != null
  const [isBalanceVisible, setIsBalanceVisible] = useState(true)

  // The stored preference seeds the scope; tiles override it for this visit.
  // Navigating to Settings unmounts the dashboard, so a changed preference is
  // picked up on the way back without syncing state in an effect.
  const { preference } = useBalanceScopePreference()
  const [scope, setScope] = useState(preference)

  // Without a breakdown there are no tiles to switch with, so nothing can leave
  // the combined view — derive the active scope rather than trusting the stored one.
  const activeScope = hasBreakdown ? scope : 'combined'
  const scopeBalance =
    activeScope === 'wallet' ? walletBalance : activeScope === 'cards' ? cardsBalance : totalBalance
  const isMasked = !isBalanceVisible
  const showsReserved = hasReserved && SCOPES[activeScope].showsReserved
  const shares = getBalanceShares(walletBalance, cardsBalance)

  const selectScope = (next) => setScope((prev) => (prev === next ? 'combined' : next))

  return (
    <section className="balance-shine relative flex h-full w-full flex-col justify-between overflow-hidden rounded-panel bg-linear-to-br from-primary-light via-primary to-primary-dark p-5 sm:p-6 lg:p-4 xl:p-5 text-white shadow-lg">
      <div className="pointer-events-none absolute -top-24 right-0 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
          {SCOPES[activeScope].label}
        </p>
        <button
          type="button"
          className="-mt-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 transition touch-manipulation hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 lg:h-8 lg:w-8 xl:h-9 xl:w-9"
          onClick={() => setIsBalanceVisible((prev) => !prev)}
          aria-label="Toggle balance visibility"
          aria-pressed={isMasked}
        >
          {isBalanceVisible ? (
            <Eye className="h-4 w-4" strokeWidth={2} />
          ) : (
            <EyeOff className="h-4 w-4" strokeWidth={2} />
          )}
        </button>
      </div>

      <div className="relative z-10 mt-1.5">
        {isLoading ? (
          <div className="space-y-2">
            <div className="shimmer h-10 w-48 rounded-input" />
            <div className="shimmer h-3 w-24 rounded-full" />
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="tabular text-3xl font-bold tracking-tight leading-none text-white sm:text-4xl lg:text-4xl xl:text-5xl">
              {isMasked ? MASKED : formatMoney(scopeBalance, { withoutSymbol: true })}
            </p>
            <p className="text-sm font-medium text-white/75">
              {currency}
              {showsReserved ? (
                <span className="tabular font-normal text-white/60">
                  {' · '}
                  {isMasked ? '••••' : formatMoney(reservedBalance, { withoutSymbol: true })}
                  {' reserved'}
                  <ReservedHelp />
                </span>
              ) : null}
            </p>
          </div>
        )}
      </div>

      <div className="relative z-10 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {isLoading ? (
          <div className="shimmer h-7 w-28 rounded-input" />
        ) : monthlyAmount != null ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-input border border-white/20 bg-white/15 px-2.5 py-1 text-sm font-semibold backdrop-blur">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span className="tabular">{formatMoney(monthlyAmount, { absolute: true })}</span>
            </span>
            <span className="text-xs text-white/75">
              {monthlyGrowth != null ? `${monthlyGrowth} ` : ''}this month
            </span>
          </>
        ) : null}

        {!isLoading && noMainCardCta ? <div className="ml-auto">{noMainCardCta}</div> : null}
      </div>

      {isLoading ? (
        <div className="relative z-10 mt-2 grid grid-cols-2 gap-2.5">
          <div className="shimmer h-20 rounded-input" />
          <div className="shimmer h-20 rounded-input" />
        </div>
      ) : hasBreakdown ? (
        <div className="relative z-10 mt-2 grid grid-cols-2 gap-2.5">
          <BreakdownTile
            icon={Wallet}
            label="Wallet"
            value={formatMoney(walletBalance)}
            share={shares.wallet}
            isActive={activeScope === 'wallet'}
            isMasked={isMasked}
            onClick={() => selectScope('wallet')}
          />
          <BreakdownTile
            icon={CreditCard}
            label="Cards"
            value={formatMoney(cardsBalance)}
            share={shares.cards}
            isActive={activeScope === 'cards'}
            isMasked={isMasked}
            onClick={() => selectScope('cards')}
          />
        </div>
      ) : null}
    </section>
  )
}
