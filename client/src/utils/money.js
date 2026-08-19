/**
 * The one place money becomes a string.
 *
 * Every amount the app renders passes through here. Before this existed the
 * same `toLocaleString(..., { currency: 'USD' })` block was copy-pasted into a
 * dozen components and several more built `'$' + n` by hand, which made a
 * display-currency switcher impossible: changing the currency meant editing
 * every one of them.
 *
 * These functions are pure and take the currency explicitly. Components should
 * not call them directly -- `useDisplayCurrency()` binds them to the user's
 * active currency (converting first) so callers pass only a number.
 */

/** The currency amounts are stored and computed in. Never converted away from. */
export const BASE_CURRENCY = 'USD'

/** Shown instead of a figure when the user has balances hidden. */
export const HIDDEN_AMOUNT_LABEL = 'Hidden'

/** Shown when a value isn't a number at all (missing/`null`), as distinct from zero. */
export const UNKNOWN_AMOUNT_LABEL = '—'

export const CURRENCY_NAMES = {
  USD: 'US Dollar',
  EUR: 'Euro',
  BAM: 'Convertible Mark',
  GBP: 'British Pound',
  CHF: 'Swiss Franc',
  JPY: 'Japanese Yen',
}

// Intl.NumberFormat construction is not cheap and a long transaction list
// formats hundreds of figures per render, so instances are reused.
const formatterCache = new Map()

function getFormatter(currency, { compact = false, signDisplay } = {}) {
  const key = `${currency}|${compact}|${signDisplay ?? ''}`
  const cached = formatterCache.get(key)
  if (cached) return cached

  const options = {
    style: 'currency',
    currency,
    ...(compact
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ...(signDisplay ? { signDisplay } : {}),
  }

  let formatter
  try {
    formatter = new Intl.NumberFormat('en-US', options)
  } catch {
    // An unknown currency code would otherwise throw mid-render. Falling back to
    // the base currency keeps the figure readable and correct in magnitude.
    formatter = new Intl.NumberFormat('en-US', { ...options, currency: BASE_CURRENCY })
  }
  formatterCache.set(key, formatter)
  return formatter
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Format an amount in `currency`.
 *
 * `Intl` is deliberate rather than a manual `'$' + n`: it places the symbol and
 * separators correctly per currency, which matters as soon as the app can show
 * anything other than dollars (BAM renders as `KM` and is not $-shaped).
 *
 * @param {string|number|null} value
 * @param {string} currency ISO 4217 code
 * @param {object} [options]
 * @param {boolean} [options.hidden] Render the hidden placeholder instead.
 * @param {boolean} [options.absolute] Drop the sign (for magnitude-only displays).
 * @param {boolean} [options.compact] Abbreviate (`$1.2K`) — for axis ticks.
 * @param {'zero'|'dash'} [options.invalid] What a non-numeric value renders as.
 * @param {'auto'|'always'|'never'|'exceptZero'} [options.signDisplay]
 * @returns {string}
 */
export function formatCurrencyAmount(value, currency = BASE_CURRENCY, options = {}) {
  const {
    hidden = false,
    absolute = false,
    compact = false,
    invalid = 'zero',
    signDisplay,
  } = options

  if (hidden) return HIDDEN_AMOUNT_LABEL

  const n = toNumber(value)
  if (n === null) {
    if (invalid === 'dash') return UNKNOWN_AMOUNT_LABEL
    return getFormatter(currency, { compact, signDisplay }).format(0)
  }

  return getFormatter(currency, { compact, signDisplay }).format(absolute ? Math.abs(n) : n)
}

/**
 * Apply a display rate to a stored amount.
 *
 * Display only. Stored balances, transaction creation, and settlement never
 * pass through this — see `useDisplayCurrency`.
 *
 * @param {string|number|null} value
 * @param {number} rate
 * @returns {number|null}
 */
export function convertAmount(value, rate) {
  const n = toNumber(value)
  if (n === null) return null
  const r = Number(rate)
  if (!Number.isFinite(r) || r <= 0) return n
  return n * r
}

/** A currency code normalised to a usable 3-letter code, or the base currency. */
export function normalizeCurrency(code) {
  const upper = String(code ?? '').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(upper) ? upper : BASE_CURRENCY
}
