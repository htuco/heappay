import { useEffect, useState } from 'react'

import ControlRow from '@/components/settings/ControlRow'
import OptionGroup from '@/components/settings/OptionGroup'
import { getSupportedCurrencies } from '@/services/fxService'
import { BASE_CURRENCY } from '@/utils/money'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'

// The currencies offered, in the order they're shown. Kept short on purpose --
// the server can price ~30, but a button group of 30 is not a usable control.
// Every entry is still checked against the server's list before being offered,
// so this can never promise a currency conversion can't actually produce.
const OFFERED = ['USD', 'EUR', 'BAM']

export default function DisplayCurrencyRow({ value, onSelect, disabled = false }) {
  const { isConverted, isRateUnavailable, isLoadingRate, disclaimer } = useDisplayCurrency()
  const [supported, setSupported] = useState(null)

  useEffect(() => {
    let cancelled = false
    getSupportedCurrencies()
      .then((result) => {
        if (!cancelled) setSupported(new Set(result?.codes ?? []))
      })
      .catch(() => {
        // Offer the base currency alone rather than options that might not work.
        if (!cancelled) setSupported(new Set([BASE_CURRENCY]))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Until the list arrives, show the full set rather than flashing a single
  // button and then widening.
  const options = supported ? OFFERED.filter((code) => supported.has(code)) : OFFERED

  const hint = isRateUnavailable
    ? `Reference rates are unavailable right now, so amounts are shown in ${BASE_CURRENCY}. Your choice is saved and will apply once rates are back.`
    : isConverted
      ? `Amounts are converted from ${BASE_CURRENCY} at reference rates. ${
          disclaimer || 'Indicative only — balances and transactions are unchanged.'
        }`
      : 'Show balances and amounts in your preferred currency, converted at reference rates.'

  return (
    <ControlRow label="Display currency" hint={hint} emphasize alignToggle>
      <OptionGroup
        options={options}
        active={value}
        onSelect={onSelect}
        disabled={disabled || isLoadingRate}
        title={isLoadingRate ? 'Loading the current rate…' : undefined}
      />
    </ControlRow>
  )
}
