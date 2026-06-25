const MAX_DECIMAL_PLACES = 2

/**
 * Restrict live typing to digits and at most two decimal places.
 * @param {string} value
 * @returns {string}
 */
export function sanitizeAmountInput(value) {
  const cleaned = String(value ?? '').replace(/[^\d.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    return `${parts[0]}.${parts.slice(1).join('')}`
  }
  if (parts[1]?.length > MAX_DECIMAL_PLACES) {
    return `${parts[0]}.${parts[1].slice(0, MAX_DECIMAL_PLACES)}`
  }
  return cleaned
}

/**
 * @param {string} value
 * @returns {number | null}
 */
export function parseAmountInput(value) {
  const sanitized = sanitizeAmountInput(String(value ?? '').trim())
  if (!sanitized || sanitized === '.') return null
  if (!/^\d+(\.\d{0,2})?$/.test(sanitized)) return null

  const num = Number(sanitized)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

/**
 * Normalize user input to a two-decimal string for API payloads (e.g. "30.3" → "30.30").
 * @param {string | number} value
 * @returns {string | null}
 */
export function normalizeAmountForSubmit(value) {
  const num = typeof value === 'number' ? value : parseAmountInput(value)
  if (num === null || !Number.isFinite(num) || num <= 0) return null
  return num.toFixed(2)
}

/**
 * Display helper — always renders X.XX when the value is a valid amount.
 * @param {string | number} value
 * @returns {string}
 */
export function formatAmountDisplay(value) {
  const normalized = normalizeAmountForSubmit(value)
  return normalized ?? ''
}
