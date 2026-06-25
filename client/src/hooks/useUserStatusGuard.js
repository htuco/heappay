import { useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { refreshSession } from '@/store/slices/authSlice'
import { selectUserStatuses } from '@/store/slices/referenceDataSlice'
import { resolveUserAccountStatus } from '@/utils/resolveUserAccountStatus'

/**
 * Resolves the signed-in user's account status for route gating.
 *
 * Limitation: backend refresh tokens are only invalidated on deleted_at, not when
 * status_id changes to suspended. Mid-session updates are picked up on the next
 * navigation or window focus via refreshSession in useAuth (not via 401).
 */
export function useUserStatusGuard() {
  const dispatch = useAppDispatch()
  const { user, isHydrated, isAuthenticated } = useAuth()
  const userStatuses = useAppSelector(selectUserStatuses)
  const refreshAttempted = useRef(false)

  const statusIdMissing =
    isHydrated && isAuthenticated && user != null && user.status_id == null

  useEffect(() => {
    if (!statusIdMissing) {
      refreshAttempted.current = false
      return
    }
    if (refreshAttempted.current) return
    refreshAttempted.current = true
    dispatch(refreshSession())
  }, [statusIdMissing, dispatch])

  // Do not block on reference data — resolveUserAccountStatus falls back to seeded ids.
  const isLoading = !isHydrated || statusIdMissing

  const status = useMemo(() => {
    if (isLoading) {
      return 'unknown'
    }

    const resolved = resolveUserAccountStatus(user?.status_id, userStatuses)
    if (resolved === 'unknown' && isAuthenticated) {
      console.warn(
        '[Heap] Could not resolve account status for status_id=%s; blocking protected routes.',
        user?.status_id ?? 'missing',
      )
    }
    return resolved
  }, [isLoading, isAuthenticated, user?.status_id, userStatuses])

  return { status, isLoading }
}
