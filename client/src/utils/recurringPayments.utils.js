const DAY_MS = 24 * 60 * 60 * 1000

// How far ahead "Due soon" looks.
export const DUE_SOON_DAYS = 7

// `label` is the compact chip/table form; `full` is for prose like
// "Every 4th of April".
export const MONTH_OPTIONS = [
  { value: 1, label: 'Jan', full: 'January' },
  { value: 2, label: 'Feb', full: 'February' },
  { value: 3, label: 'Mar', full: 'March' },
  { value: 4, label: 'Apr', full: 'April' },
  { value: 5, label: 'May', full: 'May' },
  { value: 6, label: 'Jun', full: 'June' },
  { value: 7, label: 'Jul', full: 'July' },
  { value: 8, label: 'Aug', full: 'August' },
  { value: 9, label: 'Sep', full: 'September' },
  { value: 10, label: 'Oct', full: 'October' },
  { value: 11, label: 'Nov', full: 'November' },
  { value: 12, label: 'Dec', full: 'December' },
]

/**
 * English ordinal suffix for a day-of-month (1 → "st", 11 → "th").
 * @param {number} n
 * @returns {string}
 */
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

/** Groups a raw card number into 4-digit blocks as the user types. */
export function formatRawCardNumber(value) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}

/**
 * Selected months as a readable label. An empty/absent list means "no month
 * restriction", which the API models as `months: null`.
 * @param {number[] | null | undefined} months
 * @returns {string}
 */
export function formatMonthsLabel(months) {
  if (!months || months.length === 0) return 'Every month'
  return months
    .slice()
    .sort((a, b) => a - b)
    .map((m) => MONTH_OPTIONS.find((o) => o.value === m)?.label ?? m)
    .join(', ')
}

/**
 * Prose form of the month restriction, for sentences like
 * "Every 15th of Jan, Mar and Jun".
 * @param {number[] | null | undefined} months
 * @returns {string}
 */
export function formatMonthsPhrase(months) {
  if (!months || months.length === 0) return 'every month'
  const names = months
    .slice()
    .sort((a, b) => a - b)
    .map((m) => MONTH_OPTIONS.find((o) => o.value === m)?.full ?? String(m))
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Currency display for a recurring rule amount (the API sends it as a string).
 * @param {string | number} amount
 * @returns {string}
 */
export function formatRecurringAmount(amount) {
  const n = Number.parseFloat(amount)
  if (Number.isNaN(n)) return String(amount)
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/**
 * `next_due_at` is a plain `YYYY-MM-DD` date, not an instant. Passing it to
 * `new Date()` parses it as UTC midnight, which lands on the previous day for
 * anyone west of UTC — so build a local-midnight date from the parts instead.
 * @param {string | null | undefined} value
 * @returns {Date | null}
 */
export function parseDueDate(value) {
  if (!value) return null
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function sumAmounts(rules) {
  return rules.reduce((total, rule) => {
    const n = Number.parseFloat(rule?.amount)
    return Number.isNaN(n) ? total : total + n
  }, 0)
}

/**
 * Derive the page's summary stats from the rules the list endpoint already
 * returns — no extra request, no summary endpoint.
 *
 * Note the API only ever hands back `active` rules (`list_for_user` filters
 * cancelled ones out server-side) and the model has no `paused`/`completed`
 * state, so those buckets are deliberately absent: they'd always read zero.
 *
 * @param {Array<object>} rules
 * @param {Date} [now]
 */
export function summarizeRecurringPayments(rules, now = new Date()) {
  const list = Array.isArray(rules) ? rules : []
  const active = list.filter((rule) => rule.status === 'active')

  const today = startOfDay(now)
  const dueSoonCutoff = new Date(today.getTime() + DUE_SOON_DAYS * DAY_MS)

  const dueSoon = active.filter((rule) => {
    const due = parseDueDate(rule.next_due_at)
    return due !== null && due >= today && due <= dueSoonCutoff
  })

  const dueThisMonth = active.filter((rule) => {
    const due = parseDueDate(rule.next_due_at)
    return (
      due !== null &&
      due.getFullYear() === today.getFullYear() &&
      due.getMonth() === today.getMonth()
    )
  })

  const needsAttention = active.filter((rule) => Boolean(rule.last_run_failed))

  return {
    activeCount: active.length,
    activeTotal: sumAmounts(active),
    dueSoonCount: dueSoon.length,
    dueSoonTotal: sumAmounts(dueSoon),
    dueThisMonthCount: dueThisMonth.length,
    dueThisMonthTotal: sumAmounts(dueThisMonth),
    needsAttentionCount: needsAttention.length,
  }
}
