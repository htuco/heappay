import { useDashboardCards } from './useDashboardCards'

export function useTotalBalance() {
  const { cards, isLoading, error } = useDashboardCards()

  const totalBalance = (cards ?? []).reduce((sum, card) => {
    const n = Number(card.balance)
    return sum + (isNaN(n) ? 0 : n)
  }, 0)

  const formattedBalance =
    '$' + totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return { totalBalance, formattedBalance, isLoading, error }
}
