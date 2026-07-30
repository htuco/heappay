export const BALANCE_SCOPE_KEY = 'balanceScope'

// Which figure the dashboard balance headline opens on. 'combined' is wallet +
// cards; the other two narrow it to one side of the breakdown.
export const BALANCE_SCOPES = ['combined', 'wallet', 'cards']

export const BALANCE_SCOPE_LABELS = {
  combined: 'Combined',
  wallet: 'Wallet',
  cards: 'Cards',
}

/** Returns the stored default scope, falling back to 'combined'. */
export const getStoredBalanceScope = () => {
  try {
    const stored = localStorage.getItem(BALANCE_SCOPE_KEY)
    return BALANCE_SCOPES.includes(stored) ? stored : 'combined'
  } catch {
    // A blocked or full store just means the choice doesn't persist.
    return 'combined'
  }
}

export const setStoredBalanceScope = (value) => {
  try {
    localStorage.setItem(BALANCE_SCOPE_KEY, value)
  } catch {
    // Ignored for the same reason as the read above.
  }
}

/**
 * Share of the total each side holds, as 0-100. Returns zeroes when there is
 * nothing to divide, so an empty wallet renders empty bars instead of NaN.
 */
export const getBalanceShares = (walletAmount, cardsAmount) => {
  const wallet = Number(walletAmount) || 0
  const cards = Number(cardsAmount) || 0
  const total = wallet + cards
  if (total <= 0) return { wallet: 0, cards: 0 }
  return { wallet: (wallet / total) * 100, cards: (cards / total) * 100 }
}
