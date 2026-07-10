import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { createWalletTransfer, getWalletBalance } from '@/services/walletService'
import { DATA_CHANGE_KINDS, emitDataChange, subscribeDataChange } from '@/utils/dataEvents'

function getUserId(user) {
  return user?.id ?? user?.user_id ?? null
}

/**
 * Wallet (unallocated) balance for the signed-in user, plus a helper to move
 * money between the wallet and a card. Refetches on wallet/card/transaction
 * data-change events so it stays in sync with the rest of the app.
 */
export function useWallet() {
  const { user, isLoading: authLoading } = useAuth()
  const userId = getUserId(user)
  const [walletBalance, setWalletBalance] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(
    async ({ showLoader = true } = {}) => {
      if (!userId) return
      if (showLoader) setIsLoading(true)
      setError(null)
      try {
        setWalletBalance(await getWalletBalance())
      } catch (err) {
        setError(err)
      } finally {
        if (showLoader) setIsLoading(false)
      }
    },
    [userId]
  )

  useEffect(() => {
    if (authLoading) return
    if (!userId) {
      setIsLoading(false)
      return
    }
    load()
  }, [authLoading, userId, load])

  useEffect(() => {
    return subscribeDataChange((kind) => {
      if (
        kind === DATA_CHANGE_KINDS.WALLET ||
        kind === DATA_CHANGE_KINDS.CARD ||
        kind === DATA_CHANGE_KINDS.TRANSACTION
      ) {
        load({ showLoader: false })
      }
    })
  }, [load])

  const transfer = useCallback(async ({ direction, cardId, amount }) => {
    const result = await createWalletTransfer({ direction, cardId, amount })
    // A transfer moves both wallet and card balances — refresh both surfaces.
    emitDataChange(DATA_CHANGE_KINDS.WALLET)
    emitDataChange(DATA_CHANGE_KINDS.CARD)
    return result
  }, [])

  return { walletBalance, isLoading, error, refetch: load, transfer }
}
