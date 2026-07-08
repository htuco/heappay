import { useDashboardCards } from './useDashboardCards'
import { useWallet } from './useWallet'

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
  const { cards, isLoading: cardsLoading, error } = useDashboardCards()
  const { walletBalance, isLoading: walletLoading } = useWallet()

  // card.balance is already net of escrow holds → it is the spendable balance.
  // Funds can also sit in the wallet (unallocated). The "Total Balance" headline
  // is wallet + on-cards; the two parts are surfaced separately as a breakdown.
  const cardsBalance = sumField(cards, 'balance')
  const reservedBalance = sumField(cards, 'reserved')
  const wallet = Number.isNaN(Number(walletBalance)) ? 0 : Number(walletBalance)
  const availableBalance = wallet + cardsBalance

  return {
    totalBalance: availableBalance,
    availableBalance,
    walletBalance: wallet,
    cardsBalance,
    reservedBalance,
    formattedBalance: formatUsd(availableBalance),
    formattedAvailable: formatUsd(availableBalance),
    formattedWallet: formatUsd(wallet),
    formattedCards: formatUsd(cardsBalance),
    formattedReserved: formatUsd(reservedBalance),
    hasReserved: reservedBalance > 0,
    isLoading: cardsLoading || walletLoading,
    error,
  }
}
