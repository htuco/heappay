# Family package: shared family wallet, sub-accounts & parental controls

> Status: **spec draft** (pre-implementation). Scope decisions below were made
> explicitly during scoping and should be revisited if requirements change.

## Scope decisions (v1)

| Question | Decision |
|---|---|
| Balance model | **Allowance/carve-out** — a guardian allocates a slice of their own `wallet_balance` to each dependent as *that dependent's own* balance. No pooled/shared balance. |
| Sub-account identity | **Existing users only** — a "sub-account" is a normal `User` account that a guardian links to. No new identity type, no separate login system. |
| v1 controls | Spending limits + approval workflow + card issuance control (freeze/unfreeze, issue/revoke). Not just read-only visibility. |
| Linking flow | **Invite + accept** — guardian sends a link request to an existing account by email; the invitee must explicitly accept before the relationship is active. |
| Guardians per dependent | **Single guardian per dependent in v1.** Co-parenting (2+ guardians over the same dependent) is an explicit v2 candidate, not built now. |
| Identity verification | **Self-attestation + invitee acceptance only.** There is no KYC/ID-verification capability anywhere in this app today, so "verifying you are the legal parent" is not achievable in v1. The safeguard is consent (the dependent must accept), not proof of legal guardianship. See [Out of scope](#out-of-scope--open-questions). |
| Card required? | **No.** A dependent can exist with a wallet balance and zero cards (schema already allows a `User` with no `Card` rows). Limits/approval apply to whatever spend surface the dependent actually has. |

## Roles & relationships

This is **not** a new global RBAC role. `user_roles` (`admin` / `support` / `user`)
is untouched — every guardian and every dependent is still just a `user`.
"Guardian" and "dependent" are relationship-scoped labels on a link between two
existing user accounts, resolved per-request the same way `require_admin` /
`require_staff` resolve global roles today (`server/routes/dependencies.py`).

```
User (guardian) ──1:N── FamilyLink ──N:1── User (dependent)
```

- A dependent has **at most one active `FamilyLink`** (single guardian, v1) —
  enforced with a partial unique index on `dependent_user_id` where
  `status = 'accepted'`.
- A guardian can have many dependents.
- Nothing stops a user from being a guardian in one link and a dependent in
  another (no self-links; enforce `guardian_user_id != dependent_user_id`).

### New model: `FamilyLink`

Modeled the same way `Contact` links one user to another
(`server/models/contact.py`, `owner_user_id` FK) — the closest existing
"user references user" precedent in this codebase.

| Column | Type | Notes |
|---|---|---|
| `family_link_id` | PK | |
| `guardian_user_id` | FK → `users` | |
| `dependent_user_id` | FK → `users` | |
| `status` | enum: `pending`, `accepted`, `declined`, `revoked` | |
| `invited_at` | timestamp | |
| `responded_at` | timestamp, nullable | |
| `revoked_by_user_id` | FK → `users`, nullable | either party can revoke |

New auth dependency `require_guardian_of(dependent_user_id)` in
`server/routes/dependencies.py`, same shape as `require_admin`/`require_staff`:
looks up an `accepted` `FamilyLink` row for `(current_user, dependent_user_id)`,
403s otherwise.

## Money model: allowance

No pooled balance. `users.wallet_balance` stays a single per-user scalar
(`server/models/user.py`, migration `t1u2v3w4x5y6`) — a dependent's balance is
still just their own `wallet_balance`. "Allowance" is a **transfer**, not a new
column:

```
Guardian.wallet_balance ──(allowance transfer)──▶ Dependent.wallet_balance
```

Reuses the exact mechanics already built for wallet↔card transfers
(`docs/wallet-vs-card-balance.md`, `WalletService`, row-locked
`credit_wallet`/`debit_wallet` on `UserRepository`): a new
`POST /family/dependents/{user_id}/allowance` debits the guardian's wallet and
credits the dependent's wallet atomically under the same `SELECT ... FOR
UPDATE` pattern. Guarded by `require_guardian_of`.

## Spending limits

Nothing in the current schema does this today — `category_rules`
(`a5f1c2d3e4b6`, `b6c2d3e4f5a7`) is auto-*categorization* only (keyword match →
category, no amount semantics), and the only existing amount-threshold concept
(`RefundApprovalRule.max_age_days`, feature/refund-approval-rules branch) is an
unrelated singleton for staff refund auto-decline.

### New model: `SpendingLimitRule`

Shaped like `category_rules` (per-dependent, optional per-category,
guardian-editable) but for caps instead of matching:

| Column | Type | Notes |
|---|---|---|
| `spending_limit_rule_id` | PK | |
| `dependent_user_id` | FK → `users` | |
| `category_id` | FK → `categories`, nullable | `NULL` = overall cap across all categories |
| `period` | enum: `daily`, `weekly`, `monthly` | |
| `max_amount` | Numeric(12,2) | |
| `requires_approval_above` | Numeric(12,2), nullable | single-transaction threshold that forces guardian approval regardless of period cap |
| `requires_approval_always` | bool, default false | dependent's spend always needs sign-off |
| `enabled` | bool | |
| `updated_by_user_id` | FK → `users` | guardian who set it |
| `updated_at` | timestamp | |

Enforcement point: wherever a dependent's transaction is created/evaluated
(mirrors how `RefundApprovalRule` is evaluated by the refund processor batch
job) — check period-to-date spend against `max_amount`, and check
`requires_approval_above` / `requires_approval_always` before allowing the
transaction to complete.

## Approval workflow

Reuses the existing single-approver primitive already on `Transaction`
(`requires_user_approval`, `user_approved_at`, `user_approval_method`, plus
`PaymentApprovalEvent` for the audit trail) rather than inventing a new
approval system. Today that flow is "you approve your own large transaction"
(payment-confirm preferences, `r9s0t1u2v3w4`); for a dependent, the approver is
redirected:

- Add `approver_user_id` to `transactions` (nullable). Defaults to the
  transaction's own user; when the payer is a dependent under an
  `requires_approval_*` rule, it's set to the guardian's `user_id` instead.
- Existing approve/decline handling and `PaymentApprovalEvent` audit logging
  apply unchanged — only *who* is allowed to act changes.
- Guardian sees pending-approval items the same way a user sees their own
  today, scoped by `approver_user_id = current_user`.

## Card issuance control

No new mechanism — reuse the **existing** admin/support freeze/unfreeze action
(PR #164, "let support freeze/unfreeze cards") against a dependent's cards, and
the existing card-issuance flow for new cards, both re-gated with
`require_guardian_of(dependent.user_id)` instead of `require_staff`:

- `POST /family/dependents/{user_id}/cards/{card_id}/freeze`
- `POST /family/dependents/{user_id}/cards/{card_id}/unfreeze`
- `POST /family/dependents/{user_id}/cards` (issue new card for dependent)

## Notifications

Two existing systems, both directly reusable — no new notification
infrastructure needed:

- **In-app/audit dedup ledger**: same shape as `AdminNotificationLog`
  (`recipient_user_id`, `event_type`, `reference_id`, unique-constrained to
  prevent duplicate sends) — new `event_type`s: `family_link_invited`,
  `family_link_accepted`, `allowance_received`, `spending_limit_changed`,
  `approval_requested`.
- **Email**: same shape as `EmailNotificationLog` +
  `TransactionEmailNotifier`, gated by a new per-user opt-in flag following the
  existing `email_*_enabled` column convention on `User`
  (e.g. `email_family_activity_enabled`).

## Frontend reuse

- **Invite a dependent by email** → reuse the debounced user-search/recipient
  picker already built for the payment wizard's "email recipient mode" (PR
  history: "debounced user search hook, recipient picker, search endpoint").
- **Card freeze/unfreeze UI** → reuse the admin/support card-freeze controls
  from the support user-detail modal, re-pointed at the guardian's own
  dependents.
- **Limit editor** → same list/priority editing pattern as the category-rules
  admin UI, adapted for per-dependent caps instead of global keyword rules.
- **Notification opt-ins** → reuse the existing settings notification-toggle
  components (`email_*_enabled` pattern).

## Out of scope / open questions

- **Legal guardian verification.** v1 verification is self-attestation +
  invitee acceptance only — there is no mechanism to confirm the guardian is
  actually the dependent's legal parent. If this feature needs to satisfy real
  regulatory requirements for minors (COPPA-style, e-money rules), that
  requires a separate KYC/ID-verification initiative this app doesn't have
  yet.
- **Multi-guardian (co-parenting).** Explicitly deferred; `FamilyLink` is
  single-guardian-per-dependent by constraint, not just by convention, so
  adding it later is a schema change, not just a service change.
- **Minors without independent capacity to "accept."** Invite+accept assumes
  the dependent's account can meaningfully consent. If dependents are meant to
  be young children, this assumption may not hold and needs product input
  before build.
