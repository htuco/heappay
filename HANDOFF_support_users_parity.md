# Handoff — Bring the Support users page to parity with the new Admin users page

**Audience:** Codex (implementing agent)
**Author:** prior session (admin-area redesign)
**Branch:** `feature/admin-area-polish`
**Goal:** Make the **Support** role's user-management surface match the redesigned **Admin** users page, reuse the **admin** user modal, fix navbar labelling to be role-aware, and make sure **support cannot change roles or delete users** (admin-only). Match the existing code style; small, logical commits; run lint + build + the backend tests before finishing.

---

## 0. TL;DR of what to do

1. Rebuild `client/src/pages/SupportUsersPage.jsx` to look/behave like `client/src/pages/AdminUsersPage.jsx` (KPI strip header + the richer `AdminUsersPanel` table: colored avatars, Role column, Cards, Spend(—), Last Active(—), Status pill, **Manage** action).
2. Reuse the **admin** modal `client/src/components/admin/UserDetailsDialog.jsx` on the support page (retire the support-only `client/src/components/support/UserDetailModal.jsx` for this page — see §4 before deleting anything).
3. Gate **role editing and user deletion** behind admin in `UserDetailsDialog.jsx` (support gets Suspend/Activate + card Freeze/Unfreeze, but **no Role select, no Save-role, no Delete**). The backend already enforces this; the UI must match so support never sees a control that will 403.
4. Navbar: the sidebar section label is currently `isAdmin ? 'Management' : 'Staff'`. Make it role-aware so **support sees "Support"** and **admin sees "Management"** (or "Admin" — see §5 for the exact ask). Same idea anywhere the literal "Staff" is shown.

Everything below is the detail needed to do this without re-deriving the codebase.

---

## 1. The two surfaces today (and why they differ)

There are currently **two separate user pages and two separate user modals**:

| | Admin | Support |
|---|---|---|
| Page | `client/src/pages/AdminUsersPage.jsx` (route `/admin/users`, `AdminRoute`) | `client/src/pages/SupportUsersPage.jsx` (route `/support/users`, `StaffRoute`) |
| Table component | `client/src/components/admin/AdminUsersPanel.jsx` (redesigned) | inline table inside the page |
| Modal | `client/src/components/admin/UserDetailsDialog.jsx` (redesigned, `SplitModal`) | `client/src/components/support/UserDetailModal.jsx` (older, `DialogContent`, Profile/Cards/Transactions/Refunds tabs) |
| Data source | `useAdminPageState()` → `useAdminData()` — **loads ALL users + ALL cards client-side**, normalizes them | `usersService.listWithTotal()` — **server-paginated**, raw `user_*` rows |
| Nav label | "Management" | "Staff" |

**This data-shape difference is the #1 integration hazard.** Read §3 carefully.

The redesigned admin page is the target look. Routes are declared in `client/src/App.jsx`:
- `/admin`, `/admin/users`, `/admin/transactions` → `AdminRoute` (admin only)
- `/support/users`, `/support/tickets` → `StaffRoute` (admin + manager + support)

`StaffRoute` / `AdminRoute` live in `client/src/App.jsx`; `getRoleNavLinks(role)` in `client/src/components/ui/navLinks.js` decides which links each role sees (admins get `ADMIN_NAV_LINKS`; non-admin staff get `SUPPORT_NAV_LINKS`).

---

## 2. What the admin users page is made of (the target)

`AdminUsersPage.jsx` renders:
- `AdminUsersKpiStrip` (5 tiles: Total Users, Active Users, Cards Issued, Frozen Cards, Total Spend MTD — **Total Spend is a placeholder `—`**, no backend aggregate exists).
- `AdminUsersPanel` — the table: search + Role dropdown + Status dropdown + Sort dropdown + reset button; columns **User | Role | Cards | Spend (MTD) | Last Active | Status | Actions**. Spend and Last Active are placeholder `—` (no data server-side). Colored per-user avatars (deterministic from email). Status pill (active/suspended/inactive). A single **Manage** button per row (row click also opens the modal). No `⋯` menu (was removed as redundant).
- `UserDetailsDialog` — the modal (see §3).

The page title/subtitle is **not** in the page body — it lives in the top app bar via `PAGE_META` in `client/src/components/Layout.jsx` (keys `/admin/users`, `/admin/transactions`, etc.). When you add/confirm the support route, make sure `PAGE_META['/support/users']` is set (it currently is: `{ title: 'Users', subtitle: 'Manage user accounts and card access.' }`).

All of these read their data from `useAdminPageState()` (`client/src/hooks/useAdminPageState.js`), which wraps `useAdminData()` (`client/src/hooks/useAdminData.js`).

---

## 3. The admin modal `UserDetailsDialog.jsx` — data shape it expects (CRITICAL)

The modal is built around the **normalized `selectedUser`** object produced by `useAdminData`, **not** a raw API user row. Shape (see `useAdminData.js` `normalizeUsers`/`normalizeCards`):

```
selectedUser = {
  id,                // = user_id
  fullName,          // "First Last"
  email,
  role,              // role_name string, e.g. "admin" | "manager" | "support" | "user"
  status,            // status_name string, e.g. "active" | "suspended" | "inactive"
  roleId,            // user_role_id
  statusId,          // status_id
  created_at,
  cards: [           // <-- the modal's Cards tab reads THIS prop (not a fetch)
    { id, rawId, statusId, userId,
      card: { cardHolderName, cardNumber (masked), expiryDate, brand, statusName, isActive, isDisabled } }
  ],
}
```

The modal's **Transactions** and **Activity** tabs self-fetch (`transactionsService.listForUser(userId)` and `listRefundsForUser(userId)`), but the **Cards** tab and the stat tiles use `selectedUser.cards` from the prop.

Modal props (current signature):
```
UserDetailsDialog({
  selectedUser, setSelectedUser, userRoles,
  onSave,              // (userId, { user_role_id }) => Promise  — role change (ADMIN ONLY)
  onCardBlock,         // (cardId) => Promise  — freeze   (staff ok)
  onCardUnblock,       // (cardId) => Promise  — unfreeze (staff ok)
  onSuspend,           // (userId) => Promise  (staff ok)
  onActivate,          // (userId) => Promise  (staff ok)
  onDelete,            // (userId) => Promise  (ADMIN ONLY)
  isAdmin,             // boolean — drives which controls render
})
```

### The integration choice for the support page

The support page currently uses **server-side pagination** (`usersService.listWithTotal`). The admin page loads everything client-side via `useAdminData`. You have two clean options — **pick ONE and keep it simple**:

- **Option A (recommended — least new code, full parity):** On `SupportUsersPage`, use the **same `useAdminPageState()` hook** the admin page uses, and render `AdminUsersKpiStrip` + `AdminUsersPanel` + `UserDetailsDialog` exactly like `AdminUsersPage.jsx`, but pass `isAdmin={false}` (the auth hook already gives you this). This gives identical look + the rich modal with the correct `selectedUser` shape for free. **Feasibility already verified for support (staff):** `GET /users` is `require_staff` (so support lists all users), and `GET /cards` branches on `ctx.is_staff` to allow listing **all** users' cards (non-staff are restricted to their own). So `useAdminData` works as-is for support. **Caveat:** `useAdminData` loads all users + all cards client-side. That's already what admins do; acceptable for staff too.
- **Option B (keep server pagination):** Build a small adapter that maps each raw `usersService.listWithTotal` row → the normalized `selectedUser` shape above, and fetch that one user's cards (`listCards({ user_id })`) when the modal opens, to populate `selectedUser.cards`. More code, more moving parts. Only do this if loading all users client-side is unacceptable.

**Recommendation: Option A.** It is the smallest diff and guarantees visual + behavioral parity. The whole point of the ask is "same page + same modal."

If you choose A, `SupportUsersPage.jsx` becomes nearly a copy of `AdminUsersPage.jsx` with `isAdmin={false}` and (optionally) a different KPI set if you don't want "Total Spend" on support — but keeping it identical is fine.

---

## 4. Make the admin modal support-safe (role + delete gating)

The backend **already enforces** the permission split — you must mirror it in the UI so support never sees a control that 403s:

- `PATCH /users/{id}` (role/status update) → **`require_admin`** → support CANNOT change role.
- `DELETE /users/{id}` → **`require_admin`** → support CANNOT delete.
- `POST /users/{id}/suspend` and `/activate` → **`require_staff`** → support CAN.
- `POST /cards/{id}/block` and `/unblock` → **`require_staff`** → support CAN.

(Confirmed in `server/routes/user/user.py` and `server/routes/card/card.py`.)

In `UserDetailsDialog.jsx`, the controls are already partly gated by `isAdmin`:
- **Danger Zone** (Suspend/Activate + Delete) is wrapped in `if (isAdmin) { ... }`. **This is wrong for the ask** — Suspend/Activate must be available to support (staff), only **Delete** is admin-only. Split this: render Suspend/Activate for any staff; render **Delete only when `isAdmin`**.
- The **Role `<select>`** (the `IconSelect` in "User Controls") and the footer **"Save changes"** button drive `onSave` → `PATCH` → admin-only. **Hide the Role select and the Save button when `!isAdmin`.** For support, the footer should just have **Close** (no Save), and the left rail should show the role as a read-only pill (it already shows a role pill at the top — that's enough) with the controls section showing only the status note, or omit the Role control entirely.
- **Card Freeze/Unfreeze** must stay enabled for support (staff).

Net rule for support (`isAdmin === false`):
- ✅ See everything (profile, cards, transactions, activity).
- ✅ Freeze/Unfreeze cards.
- ✅ Suspend/Activate the user.
- ❌ No Role select, no "Save changes" (role), no Delete.

Implement this with `isAdmin` checks only — do not add a new prop unless you need finer control. Keep the existing `isAdmin` plumbing (`useAuth().isAdmin` → page → modal).

---

## 5. Navbar label — role-aware (the "support not staff" ask)

File: `client/src/components/ui/navbar.jsx`, line ~69:
```jsx
<NavSection label={isAdmin ? 'Management' : 'Staff'}>
```
The ask: **if the user is support, show "Support" instead of "Staff"; same idea for admin.** Make the label reflect the actual role rather than the generic "Staff". Suggested:

```jsx
const SECTION_LABEL = { admin: 'Management', manager: 'Management', support: 'Support' }
// ...
<NavSection label={SECTION_LABEL[role] ?? 'Staff'}>
```

If the intended wording is literally "Admin" for admins, use `{ admin: 'Admin', manager: 'Management', support: 'Support' }` — confirm against the design, but the key requirement is **role-derived, not the literal "Staff"**, and **support reads "Support"**. Check there are no other hardcoded "Staff" strings that should be role-aware (grep `Staff` under `client/src`).

Also keep the **link set consistent**: `SUPPORT_NAV_LINKS` in `navLinks.js` currently gives support `Users` (`/support/users`) + `Tickets` (`/support/tickets`). After this work the support Users page matches admin's — that's the parity. Don't point support at `/admin/users` (that's `AdminRoute`); keep support on `/support/users`.

---

## 6. Concrete file-by-file checklist

- [ ] **`client/src/pages/SupportUsersPage.jsx`** — rebuild to mirror `AdminUsersPage.jsx` (Option A): `useAdminPageState()`, render `AdminUsersKpiStrip` + `AdminUsersPanel` + `UserDetailsDialog` with `isAdmin={false}`. Keep `PAGE_META['/support/users']` title in the top bar (don't add an in-page `<h1>`; the admin pages moved titles into `Layout.jsx`'s top bar).
- [ ] **`client/src/components/admin/UserDetailsDialog.jsx`** — split the Danger Zone so Suspend/Activate is staff-visible and only Delete is `isAdmin`; hide Role `IconSelect` + footer Save when `!isAdmin`. Verify card Freeze/Unfreeze stays for staff.
- [ ] **`client/src/components/ui/navbar.jsx`** — role-aware section label (support → "Support").
- [ ] **`client/src/components/support/UserDetailModal.jsx`** — once `SupportUsersPage` no longer imports it, it's orphaned. **Do not delete without confirming** it isn't imported elsewhere (`grep -rn UserDetailModal client/src`). If truly unused, leave a note for the owner or remove in a separate, clearly-labelled commit — the team's convention is "never delete files without clarification."
- [ ] (Already verified — no action needed) `useAdminData`'s endpoints are support-reachable: `GET /users` is `require_staff`; `GET /cards` allows staff to list all users' cards. Just smoke-test as `support@heap.dev` / `Password123!` after wiring.

---

## 7. Guardrails / conventions (from this repo)

- **Commits:** Title Case, every leading word capitalized except connectives (`And/For/In/To/Of/On/With/The/A/An`). **No** `Co-Authored-By` / "Generated with" trailer. Small logical chunks (backend gate / modal gating / support page / navbar — separate commits).
- **Money/flows untouched** here; this is admin/support UI only.
- **Design tokens:** interactive controls use `rounded-input` (10px). Don't hardcode radii. Tailwind v4 canonical class names (e.g. `bg-linear-to-br`, `min-w-205`) — the linter enforces these.
- **Modal:** reuse `SplitModal` (`client/src/components/ui/SplitModal.jsx`); it already handles ARIA ids + the spring open animation. Modal size variants now include `4xl`/`5xl` in `client/src/components/ui/modal.jsx`.
- **Lint rule gotchas seen in this codebase:**
  - `no-unused-vars` flags a **renamed destructured icon prop** used in JSX (`{ icon: Icon }` + `<Icon/>`). Work around by destructuring plainly and assigning to a local: `function X({ icon }) { const LocalIcon = icon; ... }`.
  - `react-hooks/set-state-in-effect` fires on synchronous `setState` in an effect body. Put the `setState` inside a `useCallback` async loader and call it from the effect (see how `UserDetailsDialog`'s tab loaders are written).
- **Checks before done (run all):**
  - `cd client && npm run lint && npm run build`
  - `cd server && uv run pytest` (should stay green; backend likely unchanged by this task, but run it).
- **Verify in browser** logged in as **support** (`support@heap.dev` / `Password123!`) AND **admin** (`admin@heap.dev` / `Password123!`):
  - Support `/support/users`: KPI strip + rich table render; opening a user shows the admin modal **without** a Role select, **without** Save, **without** Delete, **with** Suspend/Activate + card Freeze/Unfreeze.
  - Admin `/admin/users`: unchanged — Role select, Save, Delete all present.
  - Sidebar: support sees a **"Support"** section header; admin sees **"Management"**.
  - No console errors; dev server is usually already running on `http://localhost:5173` (API on `:8000`).

---

## 7b. Transaction lookup by ID for staff (admin + support)

Intent: **admin and support should be able to look up a transaction by its ID.**

**Current backend reality (verified — do not assume otherwise):**
- `GET /transactions/{id}` is gated by `get_current_user_id` and calls `service.get_by_id_for_user(..., user_id=...)`, which raises **403 Forbidden** unless the caller is a *party* to that transaction. **There is no staff bypass** — so today an admin/support user **cannot** fetch an arbitrary transaction by ID through this route.
- What staff *can* do by ID today: `GET /transactions/all` (admin only, list+filter, no single-ID lookup), `GET /transactions/user/{user_id}` (staff, a specific user's transactions), `PATCH /transactions/{id}/staff` (staff, update any transaction by ID). There is **no** "GET any transaction by ID" staff endpoint.

**So to deliver "search transaction by ID" for staff, add a small staff-scoped lookup** (don't reuse the owner-scoped route):

1. **Backend** — add a staff GET-by-id, e.g. `GET /transactions/{id}/staff` (mirror the `PATCH /transactions/{id}/staff` pattern in `server/routes/transaction/transaction.py`), gated by `require_staff`, returning the transaction with no ownership check. Add a service method like `get_by_id_staff(transaction_id)` that just returns the row (404 if missing) without the `_user_participates` check. **Route ordering:** keep literal/sub-path routes (`/all`, `/stats`, `/user/{id}`, `/{id}/staff`) registered before/disambiguated from `/{transaction_id}` so FastAPI doesn't shadow them (this repo already relies on that ordering — see how `/stats` sits before `/{id}`).
2. **Client** — add `transactionsService.getByIdAsStaff(id)` → `GET /transactions/${id}/staff` (next to the existing `getById` / `patchAsStaff` in `client/src/services/transactionsService.js`).
3. **UI** — surface an ID lookup on the admin **and** support transaction views: a small "Search by transaction ID" input on `client/src/components/admin/AdminTransactionsPanel.jsx` (used by `/admin/transactions`) and on the staff transactions surface, that calls `getByIdAsStaff` and shows the single result (or a "not found" message). Keep it staff-only (both admin and support are staff).
4. **Tests** — add a pytest for the new staff route (200 for any id as staff, 404 for missing, 403/401 for non-staff). Follow `server/tests/test_request_router.py` / `test_user_router.py` for the `dependency_overrides` + `require_staff` pattern.

If you'd rather not add an endpoint, the only no-backend alternative is to look up within an already-fetched list (e.g. filter the `/all` results client-side), which won't find transactions outside the current page — **not recommended**; add the endpoint.

---

## 8. Out of scope (do not do)

- No new backend endpoints, no auth-transport changes, no "Invite User" / "Reset Password" / "Magic Link" / per-user spend wiring (those have no backend and are intentionally placeholder/omitted).
- Don't change `AdminRoute`/`StaffRoute` gating or point support at `/admin/*` routes.
- Don't refactor the transactions/overview admin pages.
