/** @typedef {'active' | 'suspended' | 'invited' | 'unknown'} AccountStatus */

const KNOWN_STATUSES = new Set(['active', 'suspended', 'invited'])

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
  if (!match?.status_name) {
    return 'unknown'
  }

  const normalized = match.status_name.trim().toLowerCase()
  if (KNOWN_STATUSES.has(normalized)) {
    return /** @type {AccountStatus} */ (normalized)
  }

  return 'unknown'
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
