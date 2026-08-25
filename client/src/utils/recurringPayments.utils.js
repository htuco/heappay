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

/**
 * Display name for the party a rule pays.
 * @param {object} rule
 * @returns {string}
 */
export function recipientName(rule) {
  const r = rule?.recipient
  if (!r) return `Card #${rule?.recipient_card_id}`
  if (r.first_name || r.last_name) return [r.first_name, r.last_name].filter(Boolean).join(' ')
  return r.email || `Card #${rule.recipient_card_id}`
}

/**
 * Absolute form of the next run date.
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function nextDueLabel(value) {
  const due = parseDueDate(value)
  if (!due) return '—'
  return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Whole days from today to a due date, negative when the date has passed.
 * @param {string | null | undefined} value
 * @param {Date} [now]
 * @returns {number | null}
 */
export function daysUntilDue(value, now = new Date()) {
  const due = parseDueDate(value)
  if (!due) return null
  return Math.round((due.getTime() - startOfDay(now).getTime()) / DAY_MS)
}

/**
 * Relative hint next to the due date — "in 4 days", "today", "overdue by 2 days".
 * @param {string | null | undefined} value
 * @param {Date} [now]
 * @returns {string | null}
 */
export function relativeDueLabel(value, now = new Date()) {
  const days = daysUntilDue(value, now)
  if (days === null) return null
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days > 1) return `in ${days} days`
  const overdue = Math.abs(days)
  return `overdue by ${overdue} day${overdue === 1 ? '' : 's'}`
}

/**
 * Whether a rule runs every month or only in the months it lists.
 * @param {object} rule
 * @returns {'every-month' | 'specific-months'}
 */
export function frequencyKind(rule) {
  return rule?.months?.length > 0 ? 'specific-months' : 'every-month'
}

/**
 * Compact schedule for the card badge — "Monthly · 1st" or "1st of Nov".
 * @param {object} rule
 * @returns {string}
 */
export function scheduleLabel(rule) {
  const day = `${rule.day_of_month}${ordinal(rule.day_of_month)}`
  if (frequencyKind(rule) === 'every-month') return `Monthly · ${day}`
  return `${day} of ${formatMonthsLabel(rule.months)}`
}

/**
 * Status options built from the statuses actually present in the payload.
 * @param {Array<object>} rules
 * @returns {Array<{ value: string, label: string }>}
 */
export function statusOptionsFromRules(rules) {
  const present = new Set(
    (Array.isArray(rules) ? rules : []).map((rule) => rule?.status).filter(Boolean),
  )
  return [...present]
    .sort()
    .map((status) => ({ value: status, label: status.charAt(0).toUpperCase() + status.slice(1) }))
}

/**
 * The value the category filter uses for rules that carry no category. A plain
 * empty string would be indistinguishable from "no filter" in the URL.
 */
export const UNCATEGORISED_FILTER_VALUE = 'none'

/**
 * Category options built from the categories the rules actually use, mirroring
 * `statusOptionsFromRules` — a filter should never offer a choice that matches
 * nothing. `labelFor` resolves an id to a display label (the shared
 * `getCategoryMeta` via the reference-data list).
 *
 * @param {Array<object>} rules
 * @param {Array<{ transaction_category_id: number, name: string }>} categories
 * @param {(category: object) => string} labelFor
 * @returns {Array<{ value: string, label: string }>}
 */
export function categoryOptionsFromRules(rules, categories = [], labelFor) {
  const list = Array.isArray(rules) ? rules : []
  const present = new Set(list.map((rule) => rule?.category_id))
  const toLabel = labelFor ?? ((category) => category.name)

  const options = (Array.isArray(categories) ? categories : [])
    .filter((category) => present.has(category.transaction_category_id))
    .map((category) => ({
      value: String(category.transaction_category_id),
      label: toLabel(category),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  if (list.some((rule) => rule?.category_id == null)) {
    options.push({ value: UNCATEGORISED_FILTER_VALUE, label: 'Uncategorised' })
  }
  return options
}

/**
 * Client-side filtering for the recurring list.
 * @param {Array<object>} rules
 * @param {{ q?: string, status?: string, freq?: string, cat?: string, attention?: boolean }} filters
 * @param {(rule: object) => string} recipientLabel resolves the searchable name
 * @returns {Array<object>}
 */
export function filterRecurringRules(rules, filters = {}, recipientLabel = () => '') {
  const list = Array.isArray(rules) ? rules : []
  const query = (filters.q ?? '').trim().toLowerCase()

  return list.filter((rule) => {
    if (filters.status && rule.status !== filters.status) return false
    if (filters.freq && frequencyKind(rule) !== filters.freq) return false
    if (filters.cat) {
      const isUncategorised = rule.category_id == null
      if (filters.cat === UNCATEGORISED_FILTER_VALUE) {
        if (!isUncategorised) return false
      } else if (isUncategorised || String(rule.category_id) !== filters.cat) {
        return false
      }
    }
    if (filters.attention && !rule.last_run_failed) return false
    if (!query) return true
    return [recipientLabel(rule), rule.note].some(
      (field) => typeof field === 'string' && field.toLowerCase().includes(query),
    )
  })
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
 * The list includes cancelled rules, so every bucket here filters on `active`
 * first — a cancelled rule must not inflate the totals.
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
