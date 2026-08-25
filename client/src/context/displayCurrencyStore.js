import { createContext } from 'react'

/**
 * Non-component exports for the display-currency provider.
 *
 * Split out of `DisplayCurrencyContext.jsx` so that file exports only its
 * component — mixing the two breaks fast refresh (react-refresh/only-export-components).
 */
export const DisplayCurrencyContext = createContext(null)

// One rate per (base → display) pair, module-level so it survives remounts and
// page navigation. Short-lived: reference rates move, and a stale figure is
// worse than a brief loading state.
export const RATE_TTL_MS = 10 * 60 * 1000

const rateCache = new Map()

export function readRateCache(pair) {
  const entry = rateCache.get(pair)
  if (!entry) return null
  if (Date.now() - entry.storedAt > RATE_TTL_MS) {
    rateCache.delete(pair)
    return null
  }
  return entry
}

export function writeRateCache(pair, entry) {
  rateCache.set(pair, { ...entry, storedAt: Date.now() })
}

/** Exported for tests — a stale rate must never leak between cases. */
export function clearRateCache() {
  rateCache.clear()
}
