# Database Refactor Plan — Grouping, Normalization, De-crowding

Follow-up to [database-schema-audit.md](database-schema-audit.md). That document reported what is
wrong; this one designs the fix. **Nothing here has been applied to the shared database.**

## Decisions taken

| Decision | Choice |
|---|---|
| Grouping mechanism | **Postgres schemas** — `identity`, `money`, `requests`, `comms`, `security`, `audit` |
| `users` split depth | **Preferences + security + recovery** — `users` keeps identity/profile/status |
| Rollout | **Expand-contract, phased** — additive first, drops last, reversible at every step |

## Two corrections to the premise

Both worth stating, because they change what the refactor is:

**1. No `users` column is unused.** I checked all 35 against `server/` and `client/src/`. The lowest
counts are `app_pin_set_at` (2 server refs, write-only), `is_discoverable` (3/3), and
`recovery_email_verified_at` (4/0) — all wired, none dead. The table is not full of junk; it is full
of *used* columns belonging to six unrelated concerns. So the fix is **splitting by concern**, not
deleting.

**2. No table is dead either.** All 17 candidates are referenced by application code.
`admin_notification_log`, `password_reset_tokens` and `password_history` hold zero rows only because
this dev database never exercised those paths — they are not abandoned. Nothing in the schema should
be dropped for being unused.

What *is* genuinely redundant is structural, and it is the source of the sprawl you noticed:

- **Three token stores** for one concept — `email_verification_tokens`, `password_reset_tokens`, and four `recovery_email_verification_*` columns inlined on `users`. Identical shape (`token_hash`, `expires_at`, `used_at`), three implementations.
- **Two notification logs** — `email_notification_log` and `admin_notification_log`, near-identical dedup ledgers (`event_type`, `reference_id`, `sent_at`) differing only in whether the recipient column is called `user_id` or `recipient_user_id`.
- **Two biometric challenge tables** — `biometric_registration_challenges` and `biometric_authentication_challenges`, differing by one nullable `transaction_id`.
- **Seven notification preferences as columns** on `users`. This is the root cause: each new notification type has required a new column *plus* a migration. `email_outflow_enabled` was added exactly that way. Normalized to rows, a new type becomes a `INSERT`, not a schema change.

---

## Table count, honestly

The consolidations remove duplicated **entity** tables but the physical design adds **reference**
tables, and my first draft counted only the first half. Corrected:

| | Count |
|---|---|
| Today | 31 domain tables |
| − 3 consolidations (2→1 each) | −3 |
| + `user_security`, `user_notification_preferences` | +2 |
| **Entity tables** | **30** |
| + new lookups (`notification_event_types`, `notification_channels`, `notification_audiences`, `token_purposes`, `challenge_purposes`) | +5 |
| **Honest total** | **35** |

**31 → 35 is an awkward result for a refactor whose goal is less sprawl.** Recommendation: keep
`notification_event_types` — it carries real data (`default_enabled`) and is shared by both the
preferences table and the log, which is what makes "new type = seed row" work end to end. Replace the
other four with `CHECK` constraints: they are 2–4 row closed sets carrying nothing but a name. That
lands at **31 tables** — flat count, materially less redundancy. Needs your call; the group map below
assumes it.

## Target group map

30 entity tables (down from 31) across six schemas, plus reference tables per the decision above.
`alembic_version` stays in `public`.

### `identity` — who someone is
```
users                          (16 cols, down from 35)
user_security                  1:1 satellite — credentials, PIN, TOTP, confirm thresholds
user_notification_preferences  normalized rows, replaces 7 boolean columns
user_roles                     lookup
user_statuses                  lookup
contacts                       address book (owner_user_id, contact_user_id)
```

### `money` — value and its movement
```
cards                    card_types (lookup)      card_statuses (lookup)
transactions             transaction_types        transaction_statuses
transaction_categories   category_rules           recurring_payments
```

### `requests` — the polymorphic request domain
```
requests                 request_types (lookup)   request_statuses (lookup)
refund_request_details   card_freeze_request_details
refund_approval_rules    payment_approval_events
```
The polymorphic detail pattern is preserved exactly as-is — `request_id` as both PK and
`ON DELETE CASCADE` FK. No self-FK is introduced on `transactions`. Per
`context/terms-of-reference.md`, these are intentional deviations and stay.

### `comms` — outbound messaging
```
notification_log      consolidated (was email_notification_log + admin_notification_log)
verification_tokens   consolidated (was email_verification_tokens + password_reset_tokens
                      + users.recovery_email_verification_*)
```

### `security` — authentication material
```
biometric_credentials
biometric_challenges   consolidated (was registration + authentication tables)
password_history
```

### `audit` — append-only history
```
audit_log_events   user_security_audit_events   chat_messages
```

`chat_messages` sits in `audit` as the least-bad fit: it is append-only per-user history with no
domain ties. If a support/AI feature grows further it deserves its own `chat` schema — flagging now
so the placement is a decision, not an accident.

**One placement I got wrong above:** `payment_approval_events` is listed under `requests`, but it is an
append-only event log FK'd to `transactions` — it belongs in `audit` alongside the other two `*_events`
tables. Correcting it makes `requests` 6 tables and `audit` 4. Free to fix while the namespaces are
being created; a second migration if deferred.

---

## The `users` split

`users` keeps **16** columns — identity, profile, status, and the wallet:

```
user_id  email  first_name  last_name  address  avatar_url
status_id  user_role_id  wallet_balance  email_verified_at
recovery_email  recovery_email_verified_at  is_discoverable
created_at  modified_at  deleted_at
```

**Correction:** an earlier draft said 13 and omitted `is_discoverable` plus the two `recovery_email`
profile columns. The arithmetic: 35 today − 9 to `user_security` − 7 to notification preferences − 3
to `verification_tokens` = **16**.

`wallet_balance` **stays** on `users`. Moving it was offered and declined, correctly: it sits on the
apply-on-settle path and every balance read, which is the highest-risk code in the app. Keeping it
means this refactor never touches money movement.

### `identity.user_security` (1:1)

```
user_id PK/FK -> identity.users(user_id) ON DELETE CASCADE
password_hash                 totp_secret       totp_enabled
app_pin_hash                  app_pin_set_at    app_pin_failed_attempts
app_pin_locked_until          payment_confirm_enabled
payment_confirm_above_amount
```

Rationale beyond de-crowding: these are the columns a credential-stuffing or lockout path touches on
every login. Isolating them means the hot `users` row read (every authenticated request) stops
carrying secret material, and `SELECT * FROM users` stops returning `password_hash` and
`totp_secret` by default.

`refresh_token` is **not** in this list — it moves to `comms.verification_tokens` (below), which also
fixes the single-device and plaintext problems from audit F-08.

### `identity.user_notification_preferences` (normalized rows)

```
user_id     FK -> identity.users ON DELETE CASCADE
event_type  FK -> comms.notification_event_types(name)   -- seeded lookup
channel     FK -> comms.notification_channels(name)      -- seeded lookup ('email','in_app')
enabled     boolean NOT NULL
PRIMARY KEY (user_id, event_type, channel)
```

Replaces `billing_reminders_enabled`, `email_payment_sent_enabled`,
`email_payment_received_enabled`, `email_topup_enabled`, `email_refund_status_enabled`,
`email_outflow_enabled`, `notify_on_user_requests`.

**Absence must mean "use the default."** Writing seven rows per user on registration would recreate
the current rigidity in row form. Instead the lookup carries `default_enabled`, and a preference row
exists only where a user has overridden it. Adding a notification type is then one seed row, and
reading a preference is a `LEFT JOIN` with `COALESCE(pref.enabled, type.default_enabled)`.

This is the finding that matters most: it converts "new notification type = migration" into "new
notification type = seed row", permanently.

---

## The three consolidations

### `comms.verification_tokens`

```
token_id      PK
user_id       FK -> identity.users ON DELETE CASCADE
purpose       FK -> comms.token_purposes(name)   -- seeded lookup
token_hash    varchar(64) NOT NULL               -- hashed, never raw
expires_at    timestamptz NOT NULL
used_at       timestamptz NULL
created_at    timestamptz NOT NULL DEFAULT now()
revoked_at    timestamptz NULL
UNIQUE (token_hash)
INDEX (user_id, purpose)   INDEX (expires_at)
```

Seeded purposes: `email_verification`, `password_reset`, `recovery_email_verification`,
`refresh_token`.

This is **ToR-aligned rather than a new invention** — `context/terms-of-reference.md` §5 specifies
exactly this table (`email_verifications` with `purpose ENUM(registration, card_add, card_action,
login_2fa)`). The current three-way split is the drift; consolidating moves *toward* the reference
document.

It also resolves four audit findings at once: F-08 (single plaintext refresh token — becomes N hashed,
expiring, individually revocable rows, enabling per-device logout), F-12 (`recovery_email_verification_token`
stored raw — now hashed like its siblings), and the four inlined `recovery_email_*` columns leave `users`.

`users.recovery_email` and `recovery_email_verified_at` **stay** on `users` — they are profile state,
not token state. Only the token and its expiry move.

### `comms.notification_log`

```
notification_log_id  PK
recipient_user_id    FK -> identity.users ON DELETE CASCADE
recipient_email      varchar(255) NULL      -- snapshot at send time
event_type           FK -> comms.notification_event_types(name)
reference_id         varchar(128) NOT NULL
channel              FK -> comms.notification_channels(name)
audience             varchar(16) NOT NULL   -- 'user' | 'admin'
sent_at              timestamptz NOT NULL DEFAULT now()
UNIQUE (recipient_user_id, event_type, reference_id, channel)
```

The `audience` column is what the two old tables actually encoded — `admin_notification_log` existed
because the recipient was staff, not because the record differed. Note this promotes the audit's F-19
`channel` finding from "write-only, keep it" to load-bearing: it now distinguishes email from in-app
in the dedup key.

`event_type` becomes a shared lookup with the preferences table, so a notification type is defined
once and referenced by both the log and the preference — which is what makes the "new type = seed row"
property hold end to end.

### `security.biometric_challenges`

```
challenge_id    PK
user_id         FK -> identity.users ON DELETE CASCADE
purpose         FK -> security.challenge_purposes(name)  -- 'registration' | 'authentication'
challenge       varchar(255) NOT NULL UNIQUE
transaction_id  FK -> money.transactions ON DELETE CASCADE, NULL
expires_at      timestamptz NOT NULL
used_at         timestamptz NULL
created_at      timestamptz NOT NULL DEFAULT now()
INDEX (user_id, purpose)   INDEX (expires_at)
```

`transaction_id` is only ever set for `authentication`. Enforce it rather than trusting callers:
`CHECK (purpose = 'authentication' OR transaction_id IS NULL)`.

---

# Naming: full pass over 31 tables and 221 columns

## Why now — this reverses audit F-17

F-17 recommended **deferring** renames: "high-risk/low-reward on a live schema (every rename breaks
models, repositories, schemas, and any client field mapping simultaneously)." That was written before
Postgres schemas were chosen. **Phase 2 already touches all 31 tables** with
`ALTER TABLE … SET SCHEMA` and edits every model's `__tablename__` — so `RENAME TO` in the same
migration is near-zero marginal cost. After Phase 2 the original risk assessment applies again.

**The window opens exactly once.** That is the whole argument for deciding it now.

One detail that makes column renames far cheaper than F-17 assumed: SQLAlchemy decouples the DB
column name from the Python attribute. `mapped_column("card_number", String(32))` fixes the database
while `card.card_numb` keeps working in code, so DB naming can be corrected without a codebase-wide
ripple, and attribute names can follow later or never.

## Systematic finding: 6 FK columns disagree with the PK they reference

Not a cosmetic issue — it makes joins read wrong. `requests` gets this right for both of its lookup
FKs, so the correct pattern already exists in the codebase:

| FK column | References | Problem |
|---|---|---|
| `cards.status_id` | `card_statuses.card_status_id` | FK abbreviated |
| `transactions.status_id` | `transaction_statuses.transaction_status_id` | FK abbreviated |
| `transactions.category_id` | `transaction_categories.transaction_category_id` | FK abbreviated |
| `category_rules.category_id` | `transaction_categories.transaction_category_id` | FK abbreviated |
| `users.status_id` | `user_statuses.id` | both sides wrong |
| `users.user_role_id` | `user_roles.role_id` | PK side wrong |

Rule to adopt: **a FK column carries the same name as the PK it references**, except where a role
prefix distinguishes multiple FKs to one table (`sender_card_id`, `recipient_card_id`,
`actor_user_id`, `owner_user_id`, `target_user_id`, `requester_user_id`). Those are correct as-is and
should not be "fixed" — the prefix is information.

## Tier 1 — clear wins, no judgment required

### Tables
| Current | Proposed | Why |
|---|---|---|
| `audit_log_events` | `audit.log_events` | Prefix stutters against the schema name |
| `user_security_audit_events` | `audit.user_security_events` | Same |
| `refund_request_details` | `requests.refund_details` | "request" twice inside `requests` |
| `card_freeze_request_details` | `requests.card_freeze_details` | Same |

### Columns
| Current | Proposed | Why |
|---|---|---|
| `cards.card_numb` | `card_number` | Straight typo |
| `cards.expires_at` | `expires_on` | It is a `date`; `_at` reads as an instant everywhere else |
| `recurring_payments.next_due_at` | `next_due_on` | Also a `date` — and this name **already caused a bug**: `new Date('2026-08-05')` parses as UTC midnight and lands a day early west of UTC (`context/last-feature.md`). `_on` signals calendar date |
| `users.modified_at` | `updated_at` | Pairs with `created_at`; `refund_approval_rules` already uses `updated_at` |
| `user_statuses.id` | `user_status_id` | Lone outlier among four status lookups |
| `user_roles.role_id` | `user_role_id` | Matches the FK that references it |
| `chat_messages.id` | `chat_message_id` | Lone bare `id` besides the two above |
| `refund_approval_rules.id` | see Tier 2 rename | |
| `biometric_credentials.credential_row_id` | `biometric_credential_id` | Sits beside `credential_id` — two different things, near-identical names |
| `biometric_credentials.credential_id` | `webauthn_credential_id` | Says what it actually holds |
| `category_rules.rule_id` | `category_rule_id` | Convention is `<singular_table>_id` |
| `password_history.history_id` | `password_history_id` | Same |
| the 6 FK/PK mismatches above | align to the referenced PK | Joins read correctly |

## Tier 2 — real purpose mismatches, your call

**`refund_approval_rules` → `refund_approval_policy`.** The plural name promises a rule *set*; the
table is a single config row (`id = 1`, `enabled`, `max_age_days`). The name is why it looks like you
could add rules to it. Pairs naturally with audit F-14's `CHECK (id = 1)`. PK becomes
`refund_approval_policy_id`, and `enabled` → `is_enabled`.

**Lookup name columns — standardise on `name`.** Currently split: four prefixed
(`user_roles.role_name`, `user_statuses.status_name`, `card_statuses.status_name`,
`card_types.type_name`) against five bare (`request_types`, `request_statuses`, `transaction_types`,
`transaction_statuses`, `transaction_categories`). `name` has the majority, and namespacing makes the
prefixed form worse — `money.card_statuses.status_name` says "status" three times.

**`category_rules` → `category_keyword_rules`.** It matches keywords against a field; the current
name does not say what kind of rule.

**`transactions.processed_by` → `processed_by_actor` (or add a CHECK).** It is `varchar(20)`, not a
user reference, but the name reads exactly like an FK to `users`. This is the one column name in the
schema that actively misleads.

**`recurring_payments.months` → `active_months`.** Vague as-is. (Separate from F-15's point that a CSV
string is the wrong shape entirely.)

**Boolean prefixes — three conventions coexist.** `is_*` (`is_main`, `is_favorite`,
`is_discoverable`), `*_enabled` (8 columns), and bare (`backed_up`, `agent_mode`, `last_run_failed`,
`requires_user_approval`). Worth aligning the bare ones that read as adjectives — `backed_up` →
`is_backed_up`, `agent_mode` → `is_agent_mode` — and leaving `last_run_failed` and
`requires_user_approval`, which read correctly as predicates. Lowest-value item here; skip if the
rename set is getting long.

## Tier 3 — deliberately leaving alone

- **`requests.requests`, `requests.request_types`, `identity.user_roles`.** These stutter, but you read them in `JOIN` clauses far more often than in a table listing, and `requests.types` / `identity.roles` lose the entity. Unambiguity beats terseness.
- **Short PKs that are internally consistent.** `event_id` in three `*_events` tables, `token_id` in the token tables, `challenge_id` — each unambiguous within its own table, and renaming them all is a large diff for readability that is already fine in context.
- **`_log` / `_history` singular** while other tables are plural. A log is one thing; this is a recognised convention, not drift.
- **`cards.last_four`, `contacts.alias`, `users.address`.** Idiomatic and clear.
- **`cards.cvc`.** Do not rename — audit F-03 proposes removing it entirely; renaming would only make the column look sanctioned.

## Cost

Table renames: `__tablename__` per model, plus any raw SQL. Column renames: free in code if the
attribute name is kept via `mapped_column("db_name", …)`, otherwise they ripple through repositories,
services and Pydantic schemas. Neither reaches the client — DTOs insulate the API shape.

Two things break regardless: `alembic downgrade` past Phase 2 stops being meaningful (already true
from the schema move alone), and anything outside the app referencing old names — a saved Supabase
query, a view, an RLS policy. Worth auditing that before Phase 2 either way.

---

## Phases

Each phase is a separate PR, independently reversible, and safe to stop after.

### Phase 1 — Make the models describe the existing database *(prerequisite, no DB change)*

Fixes audit F-01, F-02, F-04, F-05, F-16, F-20 by declaring what already exists: register
`EmailVerificationToken` in `models/__init__.py`, declare the 24 DB-only indexes in
`__table_args__`, declare both partial unique indexes, add the missing `ondelete="CASCADE"` to model
FKs.

**Success criterion: `alembic revision --autogenerate` produces an empty diff.**

This is not optional housekeeping — it is the gate for everything after it. Today autogenerate emits
26 destructive operations, so any migration generated for Phases 2–4 arrives buried in noise that
includes `DROP TABLE email_verification_tokens`. Until the diff is empty, no generated migration for
this refactor can be reviewed with confidence. Zero DB change, so the red test baseline does not
block it.

### Phase 2 — Create schemas and move tables

`CREATE SCHEMA` × 6, then `ALTER TABLE … SET SCHEMA` per table. Cheap: `SET SCHEMA` is a catalog
update, not a rewrite, and holds a brief `ACCESS EXCLUSIVE` lock per table. Model side gets
`__table_args__ = {"schema": "..."}`; Alembic needs `include_schemas=True` in `env.py` and its
`version_table_schema` pinned. Lookups seeded by old migrations keep their data — `SET SCHEMA`
moves rows with the table.

**The Tier 1 renames belong in this same migration** (see "Naming" above). Every table is already
being altered and every `__tablename__` already being edited, so `RENAME TO` and `RENAME COLUMN` are
near-free here and expensive at any other time. Doing them separately means touching all 31 tables
twice.

Ordering matters: move parents before children within a transaction so cross-schema FKs resolve.
Cross-schema FKs are fully supported; qualified names just become mandatory in raw SQL.

### Phase 3 — Consolidations (expand-contract)

Per consolidation: create the new table + lookups → backfill → dual-write → switch reads → verify →
drop the old in a later PR. `verification_tokens` first (it is the prerequisite for taking
`refresh_token` off `users`), then `notification_log`, then `biometric_challenges`.

Refresh tokens need care: the cutover invalidates existing sessions unless the old column is read as
a fallback during the transition. Plan is dual-read for one release, then drop.

### Phase 4 — `users` split

`user_security` and `user_notification_preferences` created and backfilled, reads switched, old
columns dropped in a **separate** PR. The preference backfill must write only *overrides* — rows
where the current boolean differs from the seeded `default_enabled` — or the table starts with 91 rows
that mean nothing.

### Phase 5 — Remaining audit items

The additive constraints and indexes from the audit's Phase 2 (F-06, F-09, F-10, F-11, F-13, F-14,
F-15), applied against the new layout.

---

## Risks

**This is a large, mostly-mechanical change across every layer** — 32 models, every repository, and
Alembic's own configuration. Honest assessment of what that means:

- **The red test baseline is the real blocker.** 30 pre-existing failures means the suite currently cannot tell a refactor regression from existing noise. For a change this broad the test suite is the only practical safety net. **Recommendation: triage those 30 failures before Phase 3.** Phases 1–2 are safe without it (Phase 1 changes no schema; Phase 2 changes no column, only namespace), but I would not run consolidations or the `users` split against a suite that is already red.
- **Cross-schema `search_path`.** Any raw SQL, and Supabase's own tooling/SQL editor, will need qualified names. Worth checking whether anything outside the app (a Supabase dashboard query, a saved view, RLS policy) reads `public.users` before Phase 2.
- **Migration history references old names.** That is fine — historical revisions are never re-run against a moved schema — but `alembic downgrade` past Phase 2 stops being meaningful. Treat Phase 2 as a floor.
- **Client impact is nil for grouping, real for the `users` split.** Table names never reach the client, but the API response shape does. If `UserResponse` currently flattens preference booleans, Phase 4 must either keep that shape (assembling it server-side) or version the endpoint. Recommendation: keep the DTO stable so the client needs no change.
- **`SET SCHEMA` needs `ACCESS EXCLUSIVE`** per table. Trivial at this data size; on the pooled shared connection the risk is a queued long transaction, not the ALTER itself. Run Phase 2 when nobody is using the shared environment.

## Effort

| Phase | Scope | Risk |
|---|---|---|
| 1 | ~16 model files, no DB change | Very low |
| 2 | 6 `CREATE SCHEMA`, 31 `SET SCHEMA`, `env.py`, every model | Low, but touches everything |
| 3 | 3 consolidations × (create/backfill/switch/drop) | Medium — auth sessions |
| 4 | `users` split + backfill + DTO assembly | Medium |
| 5 | Additive constraints/indexes | Low |

---

# Physical design: FKs, indexes, constraints

The phase list above deferred this to "Phase 5, applied against the new layout." That was a
hand-wave — new tables need a physical design of their own, and the consolidations change the index
picture rather than inheriting it. This section fixes that.

## Self-review: three defects in the design above

Reviewing my own proposal against the audit's own criteria found three problems. Recording them
rather than quietly patching them:

**1. I used natural-key FKs, breaking the convention I had just praised.** The consolidations above
say `purpose FK -> comms.token_purposes(name)` and `event_type FK -> comms.notification_event_types(name)`
— text natural keys. All eight existing lookups use surrogate `*_id`. That is exactly the
inconsistency audit F-17 complains about, introduced by me.

The temptation was real: the app resolves lookups by name *constantly* — 31 call sites in
`repositories/request/request.py`, 16 in `repositories/transaction/transaction.py`, via
`get_status_id_by_name` / `get_type_id` helpers — which is why `transaction_statuses_name_key` has
26,924 scans and `request_statuses_name_key` 16,481. Natural keys would delete that round-trip
entirely.

**Resolution: keep surrogate `*_id`, and fix the chattiness separately.** Consistency across ten
lookups beats a local optimisation, and the traffic is not actually expensive — these are 4–22 row
immutable tables permanently in `shared_buffers`, so 26,924 index scans is microseconds of work, not
a bottleneck. The real fix for the chattiness is a process-level cache of the seeded reference data,
which is safe precisely because the rows never change. That is a separate, cheap improvement — not a
reason to fork the schema convention.

**2. I specified `audience varchar(16)` on `notification_log`** — a free-text enum-ish column, which
is the exact pattern audit F-15 flags. Corrected below to a seeded lookup FK.

**3. I over-claimed the security benefit of the `user_security` split.** The plan says isolating
credentials means "the hot `users` row read (every authenticated request) stops carrying secret
material." That is wrong: `routes/dependencies.py` exposes `get_current_user_id`, which resolves the
id from the JWT and does **not** load the full `User` row per request. The split is still worth doing
— `SELECT *` in repositories and admin paths does return `password_hash` and `totp_secret` today, and
narrowing that is real — but the "every request" framing was unfounded. Cohesion is the honest
justification, not per-request overhead.

## `ON DELETE` policy matrix

Audit F-07 reported the three-way split as inconsistent without resolving it. Resolving it now, since
Phase 2 recreates every FK anyway and this is the cheap moment to make intent explicit.

| Class | Policy | Tables |
|---|---|---|
| **User-private data** — meaningless without its owner | `CASCADE` | `user_security`, `user_notification_preferences`, `verification_tokens`, `notification_log`, `biometric_credentials`, `biometric_challenges`, `password_history`, `contacts` (both FKs), `category_rules`, `recurring_payments`, `user_security_audit_events`, `chat_messages` |
| **Financial records** — must never vanish silently | `RESTRICT` | `cards.user_id`, `transactions.sender_card_id`, `transactions.recipient_card_id`, `requests.requester_user_id`, `requests.target_user_id`, `refund_request_details.transaction_id`, `card_freeze_request_details.card_id`, `recurring_payments.sender_card_id`, `recurring_payments.recipient_card_id` |
| **Audit actors** — the record outlives the actor | `SET NULL` | `audit_log_events.actor_user_id`, `audit_log_events.target_user_id`, `payment_approval_events.actor_user_id`, `refund_approval_rules.updated_by_user_id` |
| **Reference/lookup** | `RESTRICT` | every `*_type_id` / `*_status_id` / `category_id` FK |

Three notes on this:

- **`RESTRICT` is chosen over leaving `NO ACTION` implicit.** They behave almost identically (RESTRICT checks immediately, NO ACTION defers to statement end); the value is that the intent is written down. Six FKs currently rely on the implicit default, which reads as forgotten rather than decided.
- **`email_notification_log` → `CASCADE` is the one genuine correction**, resolving the F-07 inconsistency where it blocked user deletion while its near-twin `admin_notification_log` cascaded. Both become `comms.notification_log` with one policy.
- **`chat_messages` moves from implicit `NO ACTION` to `CASCADE`** — deliberate. AI chat history is user-private content, and GDPR erasure should remove it.

**The important caveat:** deletion in this app is *soft* (`users.deleted_at`, `cards.deleted_at`), so
this matrix is currently theoretical — no code path issues `DELETE FROM users`. It matters the moment
a GDPR erasure path exists. **Recommendation: when that lands, implement it as an explicit, ordered
erasure procedure rather than relying on cascade semantics to do the right thing by accident** — a
`CASCADE` chain that silently removes financial records would be worse than a failed delete.

## Soft-delete vs. unique constraints — one finding, one retraction

Two unconditional unique constraints coexist with soft-delete columns
(`uq_cards_card_numb` + `cards.deleted_at`, `users_email_key` + `users.deleted_at`). Both look like
the same bug: a soft-deleted row keeps occupying the value forever. I checked both against the code
rather than assuming, and they came out **opposite**.

### Retracted: `cards` is correct as-is, and "fixing" it would break it

My first conclusion was that a soft-deleted card permanently blocks re-adding that card, fixable by
making the index partial on `deleted_at IS NULL`. **That is wrong on both counts.**

`services/card/card.py:113-115` calls `find_by_card_number_including_deleted(...)`, and if the row it
finds *is* soft-deleted it takes a **restore** path — `repositories/card/card.py:274-284` clears
`deleted_at` and re-applies the field updates atomically. Re-adding a deleted card already works; it
reactivates the existing row instead of inserting a new one.

More importantly, the proposed partial index would have **introduced** a bug. Making the constraint
`UNIQUE (card_numb) WHERE deleted_at IS NULL` permits unlimited soft-deleted rows sharing a
`card_numb`, and `find_by_card_number_including_deleted` is
`select(Card).where(Card.card_numb == card_numb)` expecting a single row — it would become
non-deterministic, and the restore path would reactivate an arbitrary one.

**So the unconditional constraint is load-bearing**: it is what guarantees that lookup finds exactly
one row. **No change. Do not "align" it with the main-card index** — the sibling partial index is
correct for a different reason (a user may hold many non-main cards, but only one main), and the
surface similarity is misleading.

### F-21 (Medium) — a soft-deleted user's email cannot be re-registered

`users` has the identical shape but **no restore path**, so here the consequence is real.
`get_user_by_email` (`repositories/user/auth.py:29`) does not filter `deleted_at`, so registration
finds the soft-deleted row and rejects the address as taken. Every other `deleted_at` check in
`services/user/auth.py` (lines 234, 332, 353, 368, …) is likewise a **rejection**, never a
reactivation — the card flow's restore behavior has no equivalent here.

Net effect: deleting an account permanently retires its email address, with no path to sign up again.

**This is a product question, not a defect to fix silently.** Permanently retiring an address is a
defensible anti-abuse position; so is letting people return. The two coherent options:

1. **Intended** — document it, and return a clear error instead of a generic "email already registered".
2. **Not intended** — mirror the card pattern: reactivate the soft-deleted user on re-registration. Note this is the safer fix and needs **no schema change**, so the constraint stays unconditional and the single-row lookup guarantee is preserved — exactly the trap the cards retraction exposes.

I'd recommend (2) via the restore path rather than a partial index, for that reason.

**Method note:** the retraction above is the argument for verifying findings against code before
proposing migrations. Both constraints presented identically from the schema alone; only the
application behavior distinguished a non-issue from a real one, and in one case the "obvious" fix was
actively harmful.

## Index design, per table

Justified against observed access patterns, not added speculatively. Where a PK or unique constraint
already covers a lookup, no extra index is listed — avoiding the redundant-prefix mistake of audit
F-10.

### `identity.users` (post-split)
```sql
PRIMARY KEY (user_id)
UNIQUE (email)                                    -- unchanged; see F-21 (fix in code, not schema)
INDEX (status_id)                                 -- admin list filters; audit F-11
INDEX (user_role_id)                              -- admin list filters; audit F-11
UNIQUE (recovery_email) WHERE recovery_email IS NOT NULL   -- existing
```
No index on `deleted_at`: it is low-cardinality (2 values) and already carried as a predicate on the
partial indexes above, which is the useful form.

### `identity.user_security`
```sql
PRIMARY KEY (user_id)   -- FK -> identity.users ON DELETE CASCADE
INDEX (app_pin_locked_until) WHERE app_pin_locked_until IS NOT NULL
```
A 1:1 satellite needs nothing else — every access is by `user_id`. The partial index exists only if a
lockout-expiry sweep is added; **omit it until that job exists** rather than carrying an unused index.

### `identity.user_notification_preferences`
```sql
PRIMARY KEY (user_id, event_type_id, channel_id)
FOREIGN KEY (user_id)        -> identity.users            ON DELETE CASCADE
FOREIGN KEY (event_type_id)  -> comms.notification_event_types  ON DELETE RESTRICT
FOREIGN KEY (channel_id)     -> comms.notification_channels     ON DELETE RESTRICT
```
The composite PK's `user_id` prefix serves "all preferences for this user", which is the only read
pattern — so **no additional index**. Column order matters: `user_id` must lead.

### `comms.verification_tokens`
```sql
PRIMARY KEY (token_id)
UNIQUE (token_hash)                              -- the primary lookup path
INDEX (user_id, purpose_id)                      -- "my active tokens", revoke-all-for-user
INDEX (expires_at) WHERE used_at IS NULL AND revoked_at IS NULL
CHECK (expires_at > created_at)
```
`UNIQUE (token_hash)` is the hot path — `repositories/user/auth.py:120` looks tokens up by hash
exactly this way today, so the pattern carries over unchanged.

The expiry index is **partial on live tokens only**, which matters more here than elsewhere: a
cleanup sweep only ever wants unused, unrevoked, expired rows, and this table accumulates dead rows
by design. The two existing tables both index `expires_at` unconditionally
(`idx_password_reset_tokens_expires_at`, `idx_email_verification_tokens_expires_at`, both `idx_scan = 0`),
so the partial form is strictly better and smaller.

### `comms.notification_log`
```sql
PRIMARY KEY (notification_log_id)
UNIQUE (recipient_user_id, event_type_id, reference_id, channel_id)   -- the dedup key
FOREIGN KEY (recipient_user_id) -> identity.users ON DELETE CASCADE
FOREIGN KEY (audience_id)       -> comms.notification_audiences ON DELETE RESTRICT   -- fixes defect #2
```
The unique constraint is both the integrity rule and the only read path (an existence check before
sending), and its `recipient_user_id` prefix covers per-user lookups — so **no extra index**. This
also retires `ix_admin_notification_log_recipient_user_id`, which audit F-10 flagged as a redundant
prefix.

Adding `channel_id` to the dedup key is a **behavior change worth calling out**: today
`uq_email_notification_user_event_ref` is `(user_id, event_type, reference_id)`, so one event can be
logged once, period. Including the channel means the same event can be sent once per channel — which
is what you want once in-app and email coexist, but it does loosen the current constraint. Deliberate,
and it needs a line in the PR.

### `security.biometric_challenges`
```sql
PRIMARY KEY (challenge_id)
UNIQUE (challenge)
INDEX (user_id, purpose_id)
INDEX (expires_at) WHERE used_at IS NULL
INDEX (transaction_id) WHERE transaction_id IS NOT NULL
CHECK (purpose_id <> <authentication> OR transaction_id IS NULL)
```
`transaction_id` is partial because it is null for every registration challenge — a full index would
be mostly dead entries. The merge lets one `(user_id, purpose_id)` index replace the two separate
per-table `user_id` indexes.

### Moved-but-unchanged tables
`money.*`, `requests.*`, and `audit.*` keep their existing indexes (all of which Phase 1 will have
declared in the models), **plus** the audit's F-06 and F-11 additions — most importantly
`ix_cards_user_id` partial on `deleted_at IS NULL`, and `transactions.status_id`.

## Consequences for the audit's index findings

The refactor changes several of them, so they should not be applied twice:

| Audit finding | Effect of the refactor |
|---|---|
| F-06 `cards.user_id` unindexed | **Still required.** Unaffected — do it in Phase 5. |
| F-10 redundant prefix indexes | **Two resolve for free.** `admin_notification_log`'s disappears with the table merge; `contacts`' is settled by Phase 1 declaring indexes explicitly. `password_history`'s still needs an explicit drop. |
| F-11 missing FK indexes | **Still required**, but apply *after* Phase 2 so index names land in the right schema. |
| F-12 raw recovery token | **Resolved by** the `verification_tokens` consolidation. |
| F-08 single plaintext refresh token | **Resolved by** the same consolidation. |
| F-15 enum-ish `varchar` | **Partly resolved** — `audience`, `purpose`, and `event_type` become lookup FKs. `chat_messages.role`, `transactions.processed_by`, `deny_reason_code`, `user_approval_method` remain and still want CHECKs. |
| F-19 write-only `channel` | **Inverted** — `channel_id` becomes load-bearing in the dedup key. |
| F-09 free-text `recurring_payments.status` | Unaffected. Still recommend the CHECK. |

## One risk the phase list missed: N+1 on preference reads

`services/email/transaction_notifier.py` reads preferences as plain attribute access on an
already-loaded `User` — `if not user.email_refund_status_enabled` at lines 58, 87, 106, 121, 136, 158.
Those are free today because the column is on the row.

After normalization each becomes a separate lookup, and these fire on the settle path where several
notifiers may run per transaction. Moving preferences to rows without addressing this trades a
crowded table for a query-per-notification.

**Mitigation, decided up front rather than discovered later:** a single
`get_preferences(user_id) -> dict[(event_type, channel), bool]` call per notification batch, resolved
once and passed down — with the `COALESCE(pref.enabled, type.default_enabled)` defaulting applied
inside it, so no caller needs to know that absence means default. This belongs in Phase 4's scope,
not as a follow-up.

## Status

**Design only — nothing implemented, nothing applied.** No model, repository, or migration file was
touched. The only changes on this branch are the two documents in `docs/` and the
`context/current-feature.md` entry recording the task.

All five phases await approval. Phase 1 is the one I would start with, since it changes no schema and
unblocks reviewable autogenerate for everything after it.
