# QA Report — E Sprint

## BUG-001 — Suspended / invited users not gated on frontend

**Status:** Closed (F20 — `feature/f20-gate-suspended-invited-sessions`)

**Original issue:** Users with `status_id` mapped to `suspended` or `invited` could use the authenticated app. Deactivated users were already enforced via `deleted_at` on the backend.

**Fix:**

- `useUserStatusGuard()` resolves `user.status_id` via `referenceDataSlice.userStatuses` (seed names: `active`, `invited`, `suspended`).
- `ProtectedRoute`, `AdminRoute`, and `StaffRoute` redirect to `/account/suspended` or `/onboarding/set-password`.
- Login banners for `?suspended=1`, `?invited=1`, `?deactivated=1`, `?passwordChanged=1`.
- Auth responses include `status_id`; `POST /auth/accept-invitation` completes invited onboarding.

**Follow-up (out of scope):** Forcible session invalidation when admin changes `status_id` (401 on refresh).
