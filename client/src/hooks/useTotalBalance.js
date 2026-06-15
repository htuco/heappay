import { useDashboardCards } from './useDashboardCards'

function sumField(cards, field) {
  return (cards ?? []).reduce((sum, card) => {
    const n = Number(card[field])
    return sum + (Number.isNaN(n) ? 0 : n)
  }, 0)
}

function formatUsd(value) {
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function useTotalBalance() {
  const { cards, isLoading, error } = useDashboardCards()

  // card.balance is already net of escrow holds → it is the spendable balance.
  // The "Total Balance" headline shows this available figure (without reservation).
  // Reserved is the in-flight (pending outgoing) sum, surfaced separately.
  const availableBalance = sumField(cards, 'balance')
  const reservedBalance = sumField(cards, 'reserved')

  return {
    totalBalance: availableBalance,
    availableBalance,
    reservedBalance,
    formattedBalance: formatUsd(availableBalance),
    formattedAvailable: formatUsd(availableBalance),
    formattedReserved: formatUsd(reservedBalance),
    hasReserved: reservedBalance > 0,
    isLoading,
    error,
  }
}
