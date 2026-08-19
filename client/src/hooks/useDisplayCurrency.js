import { useContext } from 'react'

import { DisplayCurrencyContext } from '@/context/displayCurrencyStore'
import { BASE_CURRENCY, formatCurrencyAmount } from '@/utils/money'

// Used outside the provider (tests, isolated renders): unconverted base-currency
// formatting, so a component never throws just for being mounted standalone.
const FALLBACK = {
  currency: BASE_CURRENCY,
  preferredCurrency: BASE_CURRENCY,
  rate: 1,
  source: 'identity',
  disclaimer: '',
  isConverted: false,
  isLoadingRate: false,
  isRateUnavailable: false,
  formatMoney: (value, options) => formatCurrencyAmount(value, BASE_CURRENCY, options),
  formatMoneyCompact: (value) => formatCurrencyAmount(value, BASE_CURRENCY, { compact: true }),
  convert: (value) => value,
}

/**
 * The active display currency and a `formatMoney` bound to it.
 *
 * This is how components format money — never `Intl.NumberFormat` directly, and
 * never a hand-built `'$' + n`.
 */
export function useDisplayCurrency() {
  return useContext(DisplayCurrencyContext) ?? FALLBACK
}

export default useDisplayCurrency
