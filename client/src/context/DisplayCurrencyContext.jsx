import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAppSelector } from '@/store/hooks'
import { selectAuthUser } from '@/store/slices/authSlice'
import { getPairRate } from '@/services/fxService'
import {
  BASE_CURRENCY,
  convertAmount,
  formatCurrencyAmount,
  normalizeCurrency,
} from '@/utils/money'
import {
  DisplayCurrencyContext,
  readRateCache,
  writeRateCache,
} from '@/context/displayCurrencyStore'

/**
 * Holds the user's display currency and the single rate needed to render it.
 *
 * Conversion is display-only: it never touches stored balances, transaction
 * creation, or settlement. Amounts stay in {@link BASE_CURRENCY} right up to the
 * moment they become a string.
 *
 * One rate is fetched per (base → display) pair and cached at module level, so
 * every money surface formats locally rather than making a request per figure.
 *
 * If the rate can't be resolved, the rendered currency stays at the base
 * currency and `isRateUnavailable` goes true — surfaces then show a correct
 * dollar figure plus a note rather than a converted-looking wrong one.
 */
export function DisplayCurrencyProvider({ children }) {
  const user = useAppSelector(selectAuthUser)
  const preferredCurrency = normalizeCurrency(user?.display_currency)
  const needsConversion = preferredCurrency !== BASE_CURRENCY
  const pair = `${BASE_CURRENCY}->${preferredCurrency}`

  // Only the *fetched* outcome is state. Cache hits and the no-conversion case
  // are derived during render, which keeps the effect free of synchronous
  // setState (react-hooks/set-state-in-effect).
  const [fetched, setFetched] = useState(null)

  const cached = needsConversion ? readRateCache(pair) : null
  const fetchedForPair = fetched?.pair === pair ? fetched : null
  const resolved = needsConversion ? (cached ?? fetchedForPair) : IDENTITY

  useEffect(() => {
    if (!needsConversion) return undefined
    if (readRateCache(pair)) return undefined
    if (fetchedForPair) return undefined

    let cancelled = false
    getPairRate({ from: BASE_CURRENCY, to: preferredCurrency })
      .then((result) => {
        const rate = Number(result?.rate)
        if (!Number.isFinite(rate) || rate <= 0) {
          throw new Error('Rate was not a usable number.')
        }
        writeRateCache(pair, {
          rate,
          source: result?.source ?? null,
          disclaimer: result?.disclaimer ?? '',
        })
        if (!cancelled) {
          setFetched({
            pair,
            rate,
            source: result?.source ?? null,
            disclaimer: result?.disclaimer ?? '',
          })
        }
      })
      .catch(() => {
        // `failed` means every surface renders the real stored amount in the
        // base currency — never a silently wrong figure.
        if (!cancelled) setFetched({ pair, failed: true })
      })

    return () => {
      cancelled = true
    }
  }, [needsConversion, pair, preferredCurrency, fetchedForPair])

  const isRateUnavailable = Boolean(resolved?.failed)
  const isLoadingRate = needsConversion && resolved === null
  const rate = resolved && !resolved.failed ? resolved.rate : 1
  // The currency actually rendered, which is not the preference when the rate
  // is missing or still in flight.
  const currency = needsConversion && !isRateUnavailable && !isLoadingRate
    ? preferredCurrency
    : BASE_CURRENCY
  const isConverted = currency !== BASE_CURRENCY

  const formatMoney = useCallback(
    (value, options) =>
      formatCurrencyAmount(isConverted ? convertAmount(value, rate) : value, currency, options),
    [currency, isConverted, rate],
  )

  const value = useMemo(
    () => ({
      currency,
      preferredCurrency,
      rate,
      source: resolved?.source ?? null,
      disclaimer: resolved?.disclaimer ?? '',
      isConverted,
      isLoadingRate,
      isRateUnavailable,
      formatMoney,
      /** Abbreviated, for chart axis ticks. */
      formatMoneyCompact: (amount) => formatMoney(amount, { compact: true }),
      /** The converted number, for callers that compute before rendering. */
      convert: (amount) => (isConverted ? convertAmount(amount, rate) : amount),
    }),
    [
      currency,
      preferredCurrency,
      rate,
      resolved,
      isConverted,
      isLoadingRate,
      isRateUnavailable,
      formatMoney,
    ],
  )

  return <DisplayCurrencyContext.Provider value={value}>{children}</DisplayCurrencyContext.Provider>
}

const IDENTITY = { rate: 1, source: 'identity', disclaimer: '' }
