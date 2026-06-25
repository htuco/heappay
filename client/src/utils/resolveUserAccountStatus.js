/** @typedef {'active' | 'suspended' | 'invited' | 'unknown'} AccountStatus */

const KNOWN_STATUSES = new Set(['active', 'suspended', 'invited'])

/** Baseline seed ids from server alembic — used until reference data loads. */
const SEEDED_STATUS_BY_ID = Object.freeze({
  1: 'active',
  2: 'invited',
  3: 'suspended',
})

function normalizeStatusName(name) {
  const normalized = name?.trim().toLowerCase()
  if (KNOWN_STATUSES.has(normalized)) {
    return /** @type {AccountStatus} */ (normalized)
  }
  return 'unknown'
}

/**
 * Maps the authenticated user's status_id to a guard status using reference data.
 * Seed names: active, invited, suspended, deleted (see server alembic seed).
 *
 * @param {number | null | undefined} statusId
 * @param {Array<{ id: number, status_name: string }>} userStatuses
 * @returns {AccountStatus}
 */
export function resolveUserAccountStatus(statusId, userStatuses) {
  if (statusId == null || !Number.isFinite(statusId)) {
    return 'unknown'
  }

  const match = userStatuses.find((row) => row.id === statusId)
  if (match?.status_name) {
    return normalizeStatusName(match.status_name)
  }

  return SEEDED_STATUS_BY_ID[statusId] ?? 'unknown'
}

/**
 * @param {AccountStatus} status
 */
export function getStatusHomePath(status) {
  switch (status) {
    case 'suspended':
      return '/account/suspended'
    case 'invited':
      return '/onboarding/set-password'
    case 'active':
      return '/dashboard'
    default:
      return '/login'
  }
}
