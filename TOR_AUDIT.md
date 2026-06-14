# ToR Audit — Heap vs. "Terms of Reference: Payment Services Platform" (March 2026)

Read-only review of the codebase against the mentor ToR. No code was modified.

**Important context:** `context/terms-of-reference.md` declares a set of *intentional* deviations
(FastAPI instead of Flask, React admin instead of Django, Pydantic instead of Marshmallow,
Bearer tokens instead of httpOnly cookies, Alembic instead of Flask-Migrate). Those are listed in
the Inconsistent section but tagged **[documented deviation]** — they should not be "fixed".

Audit date: 2026-06-13. Branch: `feature/mobile-responsiveness`.

---

## Done

**Auth & security**

- **User registration** — `POST /auth/register` in `server/routes/user/auth.py:32` (`register`), UI in `client/src/pages/RegisterPage.jsx`. *(Without the ToR's email-confirmation step — see Missing.)*
- **User login (JWT session)** — `POST /auth/login` in `server/routes/user/auth.py:45`, UI in `client/src/pages/LoginPage.jsx`.
- **JWT access + refresh flow with ToR lifetimes** — access token 15 min (`server/settings.py:24` `access_token_expire_minutes: int = 15`), refresh token 7 days (`server/services/user/auth.py:49` `timedelta(days=7)`); `POST /auth/refresh` in `server/routes/user/auth.py:58`.
- **Logout / refresh-token invalidation** — `POST /auth/logout` in `server/routes/user/auth.py:72`; stored `refresh_token` column on `users` (`server/models/user.py:26`, migration `223eb2179c9f_add_refresh_token_to_users.py`).
- **bcrypt password hashing** — `server/services/user/auth.py:29-34` (`bcrypt.gensalt(rounds=12)` / `hashpw` / `checkpw`).
- **RBAC enforced server- and client-side** — `require_admin` / `require_staff` / `get_user_context` in `server/routes/dependencies.py`; `AdminRoute` / `StaffRoute` / `ProtectedRoute` in `client/src/App.jsx:65-83`. *(Role set differs from ToR — see Inconsistent.)*
- **Change password (requires current password)** — `POST /auth/change-password`, `server/routes/user/auth.py:87` (ToR analog of `PUT /users/me/password`).

**User profile (ToR "Users" endpoints)**

- **Get current profile** — `GET /auth/me`, `server/routes/user/auth.py:169`.
- **Update profile** — `PATCH /auth/me`, `server/routes/user/auth.py:184` (plus avatar upload `POST /auth/me/avatar:206`, beyond ToR).
- **Delete/close own account (as deactivation)** — `POST /auth/deactivate`, `server/routes/user/auth.py:143`. *(Shape differs from ToR `DELETE /users/me` — see Inconsistent.)*

**Dashboard**

- **Summary statistics — balance, recent activity, card status** — `client/src/pages/Dashboard.jsx` composes `TotalBalanceWidget`, recent activity (`utils/dashboardRecentActivity.js`), and `components/dashboard/CardStatusOverview.jsx`.

**Transactions**

- **New Transaction — Single (amount, recipient, reference)** — `POST /transactions` in `server/routes/transaction/transaction.py:286`; UI `client/src/components/payment/PaymentWizard.jsx`. Amount + recipient card + `note` (the ToR "reference" analog).
- **History — paginated with date/type/status filters** — server pagination `GET /transactions` (`transaction.py:73`, `page`/`page_size`); date, status, and type filters in `client/src/components/payment/TransactionHistory.jsx:51-62`. *(Filters are client-side — see Inconsistent.)*
- **Get single transaction detail** — `GET /transactions/{transaction_id}`, `transaction.py:263`; UI `components/payment/TransactionDetailPanel.jsx`.
- **Cancel a pending transaction** — exists as `PATCH /transactions/{id}` → `failed` with `USER_DENIED` (`server/services/transaction/transaction.py:274` in `_apply_status_change`). *(Different verb/shape than ToR `DELETE` — see Inconsistent.)*
- **Mock payment engine (approval/decline logic)** — `server/services/transaction/TransactionProcessorService` (`services/transaction/transaction_processor.py`) with rule-based deny codes (`SELF_TRANSFER`, `SENDER_CARD_EXPIRED`, …), auto-allow, manual-review threshold (`settings.py:43`), pending timeout, scheduled by `server/jobs/scheduler.py` + `jobs/process_pending_transactions.py`. *(No receipts — see Missing.)*

**Cards**

- **List / create / get / delete cards for current user** — `server/routes/card/card.py` (`GET /cards:102`, `POST /cards:200`, `GET /cards/{id}:185`, `DELETE /cards/{id}:274` soft-delete + `restore:352` + admin `hard:301`); UI `client/src/pages/WalletPage.jsx`, `client/src/components/AddCardModal.jsx`.
- **Card lifecycle: block / unblock** — `POST /cards/{card_id}/block` (`card.py:322`) and `/unblock` (`card.py:337`), status-driven. *(Staff-only and without the ToR's email-verification step — see Inconsistent/Missing.)*
- **Card type/status reference data** — lookup tables + seeds (`server/alembic/versions/4c2f9b8d1e7a_seed_reference_tables.py`), routes `routes/card/card_type.py`, `routes/card/card_status.py`.

**Admin (back-office)**

- **User management full CRUD + role/status assignment** — `server/routes/user/user.py` (list:40, search:64, get:85, create:99, patch:120, delete:144, suspend:159, activate:172); UI `client/src/pages/AdminPage.jsx` with `AdminUsersPanel`, `UserDetailsDialog`.
- **Card oversight** — `AdminCardsManagementPanel.jsx`, `ManageCardDialog.jsx` backed by the same `/cards` endpoints (staff paths).
- **Transaction audit** — `GET /transactions/all` (admin, `transaction.py:98`), `GET /transactions/user/{user_id}` (staff, `transaction.py:125` with status/type filters + sort), staff patch `transaction.py:171`; UI `AdminTransactionsPanel.jsx`.
- **Reporting & analytics (partial)** — `GET /transactions/summary` income/expense per month (`transaction.py:207`), admin KPI row (`components/admin/AdminKpiRow.jsx`). *(User activity logs missing — see Missing.)*

**Platform / deliverables**

- **React SPA (Vite) + Redux Toolkit + Axios + Tailwind** — `client/package.json`, `client/src/store/slices/`, `client/src/services/*.js`; matches ToR §4.2 stack choices (Redux Toolkit is one of the two permitted options).
- **PostgreSQL + SQLAlchemy + migrations + seed data** — `server/database.py`, `server/models/`, `server/alembic/versions/` (21 migrations incl. seeds `4c2f9b8d1e7a`, `c1a2b3d4e5f7`, `d8f3c1b05e9a`).
- **OpenAPI/Swagger docs** — FastAPI built-in `/docs` (app created in `server/main.py:54`). [documented deviation from Flask-OpenAPI]
- **Backend test suite** — `server/tests/` (10 pytest files: auth router, user router, card main, transaction balances/idempotency/processor, deactivated auth, …) using pytest + httpx per ToR's pytest requirement.
- **README** — root `README.md` with setup, env, and run instructions.
- **Landing screen** — `client/src/pages/LandingPage.jsx` (marketing/intro page).

---

## Incomplete / Missing

1. **Recurring transactions + schedules (ToR §3.2, §12.4, endpoints `/transactions/recurring`, `/schedules*`)** — Nothing exists: no `recurring_schedules` table in `server/models/` or any Alembic migration, no recurring endpoints, no UI. Transaction types are seeded as `deposit/payment/refund/withdrawal/chargeback` (`c7d4e9f01a2b_add_transaction_types_and_transactions.py:38-43`) — no `single`/`recurring` concept. Should live in `server/models/` + `routes/transaction/` (or a new `schedule` feature folder) + a payments UI step.

2. **Transaction templates (ToR §3.2 Templates/Edit Template, §12.5, `/templates*` incl. execute)** — Nothing exists: no model, endpoints, or UI (grep for "template" in `server/` and `client/src/` finds only unrelated matches). Listed as outstanding in `context/terms-of-reference.md` roadmap.

3. **Card reports: stolen / lost (ToR §3.2 Report a Problem, §12.6 card_reports, endpoints `/cards/{id}/report/*`, `/cards/{id}/reports`)** — No `card_reports` table, no report endpoints, no "Report a Problem" UI in `client/src/pages/SettingsPage.jsx`. Card statuses seeded as `active/frozen/expired/cancelled` (`4c2f9b8d1e7a`) — `reported_stolen` / `reported_lost` states don't exist. Block/unblock exist but only as staff actions (`routes/card/card.py:322,337`), not the user-initiated report flow the ToR describes.

4. **Email verification flows + `email_verifications` table (ToR §3.1 registration confirmation, §3.2 card email verification, §12.7)** — Entirely absent: no `email_verified` column on `users` (`server/models/user.py`) or `cards` (`server/models/card.py`), no verification model/endpoints (`/auth/verify-email`, `/auth/resend-verification`, `/cards/{id}/verify-email`), no SMTP/email code anywhere in `server/` (grep for smtp/mail/sendgrid/mailtrap returns nothing). [Absence of Flask-Mail specifically is a documented deviation, but no replacement email service exists either.]

5. **OTP delivery + verification for sensitive actions (ToR §3.3, §4.6)** — Absent; no OTP code anywhere in the repo.

6. **Forgot password / reset password (`POST /auth/forgot-password`, `/auth/reset-password`)** — Absent. `server/routes/user/auth.py` has only the logged-in `change-password`; no token-based reset path, no client UI.

7. **Email notification system (ToR §3.3 — confirmations, OTP, alerts)** — Absent server-side. A client-side in-app notification panel exists (`client/src/components/notifications/`), but no email of any kind is sent.

8. **CSV export of transaction history (`GET /transactions/export`)** — Absent; no export endpoint in `routes/transaction/transaction.py` and no export UI in `TransactionHistory.jsx`.

9. **Contact Us form (ToR §3.1 "full functionality form")** — Absent: no contact route in `client/src/App.jsx`, no contact section in `LandingPage.jsx`, no backend endpoint.

10. **About + Team public pages (ToR §3.1)** — Absent: the only public page is `LandingPage.jsx`; no About/Team routes or sections (grep for "about"/"team" in the page finds none).

11. **Dashboard stats endpoint (`GET /users/me/stats` — balance, tx count, cards)** — No single stats endpoint; the dashboard composes `GET /transactions/summary` + `GET /cards` client-side (`client/src/hooks/useTotalBalance.js`, `useDashboardCards.js`). Functionality is there; the consolidated endpoint is not.

12. **Receipts from the mock payment engine (ToR §3.3)** — `TransactionDetailPanel.jsx` is a detail view, but no receipt artifact (downloadable/emailed) is generated anywhere.

13. **User activity logs (ToR §3.3 Reporting & Analytics)** — No audit/activity-log table or admin view. Closest is `processed_by`/`deny_reason_code` on transactions (`server/models/transaction.py:43-44`).

14. **Docker Compose for local + staging (ToR §5 deliverable, §10 criteria)** — No `Dockerfile` or `docker-compose.yml` anywhere in the repo.

15. **Automated daily `pg_dump` backups (ToR §4.5)** — Nothing in the repo (no script, cron, or CI config).

16. **SRS + Figma wireframes + admin guide deliverables (ToR §5)** — Not present in the repo. They may exist externally; flagged as unverifiable from the codebase. The only docs deliverables present are `README.md` and FastAPI's auto `/docs`.

17. **HTTPS in staging/production (ToR §4.6)** — Not verifiable from the repo; no deployment configuration is committed (CORS regex in `server/main.py:63` only whitelists `http://localhost`).

---

## Inconsistent

### Documented deviations (intentional per `context/terms-of-reference.md` — do not "correct")

1. **Backend framework** — ToR: Flask + Flask-RESTful. Code: FastAPI (`server/main.py`, `fastapi` across `routes/`). [documented deviation]
2. **Admin layer** — ToR: separate Django + Django Admin at `/admin/*`. Code: role-gated React page `client/src/pages/AdminPage.jsx` backed by the same FastAPI endpoints; no Django anywhere. [documented deviation]
3. **Migrations** — ToR: Flask-Migrate (+ Django migrations). Code: Alembic directly (`server/alembic/`). [documented deviation]
4. **Validation** — ToR: Marshmallow. Code: Pydantic (`server/schemas/`) + Zod (`client/src/schemas/`). [documented deviation]
5. **JWT transport** — ToR §4.2: httpOnly cookies. Code: Bearer `Authorization` header (`HTTPBearer` in `server/routes/user/auth.py:25`) with axios interceptor refresh on the client (`client/src/services/authService.js`). [documented deviation]
6. **Email stack** — ToR: Flask-Mail. Code: nothing yet (planned as a FastAPI-side service). [documented deviation — but see Missing #4/#7: no replacement exists]
7. **Tests** — ToR: pytest (Flask) + Django TestCase. Code: pytest + httpx against FastAPI only. [documented deviation]

### Undocumented inconsistencies

8. **No `/api/v1` prefix** — ToR catalogues every endpoint under `/api/v1/...`; code mounts routers at bare paths `/auth`, `/users`, `/cards`, `/transactions`, `/requests` (`server/main.py:91-104`, router prefixes in each `routes/*/*.py`).

9. **Users schema diverges** (`server/models/user.py` vs ToR §12.1):
   - Doc says single `name`; code has `first_name` + `last_name` (lines 14–15).
   - Doc says inline `role ENUM('visitor','user','admin')`; code uses lookup FKs `user_role_id` → `user_roles` and `status_id` → `user_statuses` (lines 18–19).
   - Doc requires `email_verified boolean`; code has none.
   - Code adds columns the doc doesn't have: `address`, `refresh_token`, `deleted_at`, `billing_reminders_enabled`, `avatar_url`, `modified_at`.

10. **Roles set differs** — Doc: `visitor / user / admin`. Code seeds `admin / manager / support / user` (`4c2f9b8d1e7a_seed_reference_tables.py:25-31`); "visitor" is implicit (unauthenticated), and a "staff" tier (manager/support) exists that the doc never mentions (`require_staff` in `routes/dependencies.py`, `/support/*` pages in `App.jsx:226-228`).

11. **Cards schema diverges** (`server/models/card.py` vs ToR §12.2):
    - Doc: store only `card_number_masked` (last 4). Code stores the **full card number** (`card_numb`, line 24, unique-constrained) **and CVC** (`cvc`, line 26) in plaintext, plus `last_four`. This is a security-relevant divergence worth an explicit decision, not just drift.
    - Doc: `card_type ENUM('visa','mastercard')`. Code: `card_types` lookup of `type_name × vendor` (debit/credit × visa/mastercard, later extended to Amex/Discover/JCB/etc. in `c1a2b3d4e5f7_seed_all_card_vendors.py`).
    - Doc statuses: `active/blocked/reported_stolen/reported_lost`. Code statuses: `active/frozen/expired/cancelled`.
    - Doc: `expiry_month` + `expiry_year` ints. Code: single `expires_at` Date (line 28).
    - Doc has no card balance; code adds `balance Numeric(12,2)` (line 29) — Heap's balance model lives on the card.
    - Doc requires `email_verified` on cards; code has none. Code adds `is_main`, `deleted_at`, `cardholder_name` (nullable; doc has it required).

12. **Transactions schema diverges** (`server/models/transaction.py` vs ToR §12.3):
    - Doc: `user_id` + `card_id`. Code: `sender_card_id` (nullable for deposits) + `recipient_card_id` (lines 19–24) — card-to-card transfers, no direct user FK.
    - Doc type enum: `single/recurring`. Code types: `deposit/payment/refund/withdrawal/chargeback` (seed `c7d4e9f01a2b`).
    - Doc status enum: `pending/approved/declined/cancelled`. Code statuses: `pending/completed/failed/reversed` (seed `d8f3c1b05e9a:39-42`).
    - Doc columns `currency char(3)`, `recipient text`, `reference text` don't exist; code has `note` (line 32) and implicit single currency.
    - Code adds: `idempotency_key` (unique), `processing_eligible_at`, `processed_at`, `processed_by`, `deny_reason_code` — none in the doc.

13. **Refunds modeled via polymorphic `requests`** — The doc has no refund mechanism at all (closest is `cancelled` status); code implements refunds through `requests` / `request_types(refund, money_request)` / `refund_request_details` (`server/models/request.py`, `a1b2c3d4e5f6_add_requests_tables.py`) with staff approve/decline (`routes/request/request.py:112,138`). Intentional Heap addition per project docs. *(Note: `money_request` type is seeded but has no endpoints yet.)*

14. **Cancel pending transaction shape** — Doc: `DELETE /api/v1/transactions/{tx_id}`. Code: `PATCH /transactions/{id}` transitioning `pending → failed` with `USER_DENIED` (`services/transaction/transaction.py:258-283`); no DELETE route exists.

15. **Card block/unblock ownership** — Doc §3.2: blocking is a *user* settings flow ("Block Card (no reason) — manual card block with email verification"). Code: `POST /cards/{id}/block|unblock` are **staff-only** (`Depends(require_staff)`, `routes/card/card.py:325,341`); regular users cannot block their own card, and there's no verification step.

16. **Account deletion semantics** — Doc: `DELETE /api/v1/users/me` deletes own account. Code: self-service is `POST /auth/deactivate` (status change with password confirmation, `routes/user/auth.py:143`); hard `DELETE /users/{user_id}` is admin-only (`routes/user/user.py:144`).

17. **History filters are client-side** — Doc implies API-level filters (`GET /transactions` "filter: date, type, status"). Code: the user-facing list endpoint accepts only `page`/`page_size` (`routes/transaction/transaction.py:74-79`); date/status/type filtering happens in the browser (`TransactionHistory.jsx:51-62`). Server-side status/type filters exist only on the staff endpoint `/transactions/user/{user_id}` (`transaction.py:130-139`); no date filter anywhere server-side.

18. **React Router version** — Doc §4.2: React Router v6. Code: `react-router-dom` v7 (`client/package.json`). Minor.

19. **Features beyond the ToR scope** — present in code but nowhere in the doc (fine per project conventions, listed for completeness): AI support chat with vector knowledge sync (`routes/chat/`, `repositories/vector/`, `services/embedding/`, Groq/Cohere keys in `settings.py:25-27`), support tickets surface (`pages/SupportTicketsPage.jsx`, `SupportUsersPage.jsx`), Supabase image storage/avatars (`routes/storage/`), invited-user onboarding (`OnboardingSetPasswordPage.jsx`, `POST /auth/accept-invitation`), account suspension flow, main-card selection, card balance sweep on delete, transaction idempotency keys, in-app notification preferences.

---

## Document gaps (ambiguities in the ToR itself)

- The dashboard requires "balance" statistics, but the ToR schema (§12) defines no balance column on any table and no ledger mechanism — balance is unimplementable as specified.
- `role ENUM('visitor', ...)` on the Users table is self-contradictory: visitors are by definition unauthenticated and have no row.
- Transactions carry both `user_id` and `card_id` while cards already belong to users — redundant and divergence-prone; the code's card-pair model is arguably cleaner.
- §3.2 says recurring transactions are configured per-transaction, while §12.4 hangs the schedule off a transaction FK — it's unclear whether each recurrence creates a new transaction row.
- The endpoint table omits any unblock-verification or report-verification endpoint even though §3.2 requires email verification for blocks; the `card_reports.verified` flag has no API to set it.
