import { useCallback, useEffect, useState } from 'react'
import {
  BALANCE_SCOPE_KEY,
  getStoredBalanceScope,
  setStoredBalanceScope,
} from '@/utils/balanceScope'

const BALANCE_SCOPE_CHANGE_EVENT = 'heap:balance-scope-change'

/**
 * The balance view the dashboard headline opens on — 'combined' | 'wallet' | 'cards'.
 *
 * Stored on this device only, mirroring the theme preference: Settings writes it,
 * the dashboard widget reads it as its starting scope. The custom event keeps
 * readers in this tab in sync; the storage event covers other tabs.
 */
export function useBalanceScopePreference() {
  const [preference, setPreference] = useState(getStoredBalanceScope)

  useEffect(() => {
    function syncFromStorage() {
      setPreference(getStoredBalanceScope())
    }

    function onStorage(event) {
      if (event.key === BALANCE_SCOPE_KEY || event.key === null) {
        syncFromStorage()
      }
    }

    window.addEventListener(BALANCE_SCOPE_CHANGE_EVENT, syncFromStorage)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(BALANCE_SCOPE_CHANGE_EVENT, syncFromStorage)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const setBalanceScope = useCallback((value) => {
    setStoredBalanceScope(value)
    setPreference(value)
    window.dispatchEvent(new Event(BALANCE_SCOPE_CHANGE_EVENT))
  }, [])

  return { preference, setBalanceScope }
}
