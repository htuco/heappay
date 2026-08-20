/**
 * Audit-log event classification and labelling.
 *
 * Every event used to render as the same light pill, so "Login success" and
 * "Login failed" were indistinguishable while scanning a page of 20 rows.
 *
 * Two event vocabularies are live in the same table, which is why this matches
 * on the final *token* rather than on a whole-string suffix:
 *   - flat snake_case from `utils/audit_log.py` (`login_failed`, `refund_approved`)
 *   - dot-namespaced from the dev seeder (`user.login_failed`, `request.refund.approved`)
 * Splitting on both separators covers both, and any new event that ends in a
 * known outcome word gets the right tone with no client change.
 *
 * The buckets are about outcome, not severity:
 *   success  — completed, granted, or created
 *   negative — failed, refused, or removed/restricted something
 *   neutral  — a state change with no direction (changed, updated, login, logout)
 */

export const AUDIT_OUTCOME = {
  SUCCESS: 'success',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
}

const SUCCESS_TOKENS = new Set([
  'success',
  'approved',
  'activated',
  'created',
  'verified',
  'added',
  'settled',
  'completed',
  'restored',
  'unfrozen',
  'unblocked',
])

const NEGATIVE_TOKENS = new Set([
  'failed',
  'declined',
  'denied',
  'deleted',
  'removed',
  'revoked',
  'cancelled',
  'canceled',
  'suspended',
  'frozen',
  'blocked',
  'locked',
  'expired',
])

function lastToken(eventType) {
  const parts = eventType.toLowerCase().split(/[._]+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

/**
 * Classify an audit event type into one of the three outcome tones.
 * Unknown or missing types fall back to `neutral` rather than throwing — the
 * server sends the raw type as its own label when it has no mapping.
 */
export function auditEventOutcome(eventType) {
  if (typeof eventType !== 'string' || !eventType) return AUDIT_OUTCOME.NEUTRAL

  const token = lastToken(eventType)
  if (NEGATIVE_TOKENS.has(token)) return AUDIT_OUTCOME.NEGATIVE
  if (SUCCESS_TOKENS.has(token)) return AUDIT_OUTCOME.SUCCESS
  return AUDIT_OUTCOME.NEUTRAL
}

/**
 * Display label for an event.
 *
 * The server maps known types to prose ("Login failed") and falls back to the
 * raw type when it has no entry — which is most rows in practice, since the
 * dot-namespaced vocabulary is absent from its label map. Rather than print
 * `request.refund.approved` in the table, humanise the identifier here. Display
 * only: the stored event type and the CSV export are untouched.
 */
export function auditEventLabel(event) {
  const type = event?.event_type ?? ''
  const label = event?.event_label ?? ''

  if (label && label !== type) return label
  if (!type) return 'Unknown event'

  const words = type.split(/[._]+/).filter(Boolean).join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
