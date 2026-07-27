const DAY_MS = 24 * 60 * 60 * 1000

// How far ahead "Due soon" looks.
export const DUE_SOON_DAYS = 7

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
