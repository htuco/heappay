# Database Schema Audit — 2026-07-28

**Scope:** all 32 tables in `public`, their models, migrations, and the queries the repositories
actually run. **Report only — no migrations were applied.** Every DB interaction in this audit was a
read-only `SELECT` against catalog views (`pg_attribute`, `pg_indexes`, `pg_constraint`,
`pg_stat_user_tables`, `pg_stat_user_indexes`) plus one `alembic revision --autogenerate` (which
introspects read-only and writes a local file; the generated file was deleted, see F-01).

- **Environment:** shared Supabase Postgres (`aws-0-eu-west-1.pooler.supabase.com`), `alembic_version` = `8fdad242dfca`, 61 migrations applied.
- **Test baseline before any change:** `uv run pytest` → **30 failed, 327 passed**. Pre-existing on `main` (working tree had zero tracked changes). See "Test baseline" below.
- **No native Postgres enums exist** — every status/type is a lookup table. The convention is held consistently, which is good.

## How to read the volume numbers

The DB is tiny: 56 transactions, 16 cards, 13 users, 228 audit rows. At that size Postgres
**correctly** prefers sequential scans, so the large `seq_scan` counts below are *not* evidence of
slowness today. They are evidence of **which access paths the app hammers**, and therefore which
indexes will matter at scale. The upside: `CREATE INDEX` on a 56-row table is effectively free and
lock-free right now — the cheapest moment to fix this is now, not after growth.

---

## Severity summary

| # | Severity | Table / area | Issue |
|---|---|---|---|
| F-01 | **Critical** | `email_verification_tokens` | Model not registered → autogenerate emits `DROP TABLE` |
| F-02 | **Critical** | `cards` | Main-card partial unique index absent from model → autogenerate drops it |
| F-03 | **Critical** | `cards` | Card CVC and full card number persisted in plaintext |
| F-04 | **High** | 24 indexes | Exist only in DB, absent from models → autogenerate drops them |
| F-05 | **High** | `password_reset_tokens`, `email_verification_tokens` | Model FK omits `ondelete=CASCADE` → autogenerate silently removes cascade |
| F-06 | **High** | `cards` | No index on `cards.user_id` — the single hottest access path |
| F-07 | **High** | user-owned children | FK `ondelete` split between `CASCADE` and `NO ACTION` with no rule |
| F-08 | **High** | `users` | `refresh_token` stored plaintext in a single column |
| F-09 | **High** | `recurring_payments` | `status` is free-text `varchar`, not a lookup FK like every other status |
| F-22 | **High** | money flows | Documented apply-on-settle is contradicted by the code, which applies escrow **on create** |
| F-10 | Medium | 3 tables | Redundant prefix indexes duplicating a composite |
| F-11 | Medium | several | Missing indexes on FK / filter columns |
| F-12 | Medium | `users` | `recovery_email_verification_token` plaintext, breaking the `token_hash` convention |
| F-13 | Medium | `cards`, `users` | No non-negative CHECK on stored balances |
| F-14 | Medium | `refund_approval_rules` | Singleton table with nothing enforcing one row |
| F-15 | Medium | several | Enum-ish `varchar` columns with no CHECK; `recurring_payments.months` is a CSV string |
| F-16 | Medium | `users` | `modified_at` maintained by hand in ~10 repository sites, no `onupdate` |
| F-17 | Low | schema-wide | Naming inconsistencies (defer — see rationale) |
| F-18 | Low | `user_roles` | Missing `created_at` that every other lookup table has |
| F-19 | Low | 3 columns | Write-only columns never read back |
| F-20 | Low | `contacts` | `index=True` generates `ix_*` names while DB has `idx_*` |

---

# Critical

## F-01 — `alembic revision --autogenerate` emits `DROP TABLE email_verification_tokens`

**Table:** `email_verification_tokens` (3 live rows)

[`models/__init__.py`](../server/models/__init__.py) imports 32 models but **omits
`EmailVerificationToken`**. The class in
[`models/email_verification_token.py`](../server/models/email_verification_token.py) is therefore
never attached to `Base.metadata`, so autogenerate sees the live table as an orphan and drops it:

```python
op.drop_index(op.f('idx_email_verification_tokens_expires_at'), table_name='email_verification_tokens')
op.drop_index(op.f('idx_email_verification_tokens_user_id'), table_name='email_verification_tokens')
op.drop_table('email_verification_tokens')
```

This is Critical because it weaponises the repo's own convention. `CLAUDE.md` says *"Always
autogenerate, then review the diff"* — a reviewer who autogenerates for an unrelated change and
skims the diff destroys a table holding live verification tokens. The model file exists and looks
maintained, so nothing signals that it is unregistered.

**Fix:** add `from models.email_verification_token import EmailVerificationToken  # noqa: F401` to
`models/__init__.py`. Zero DB change — it only corrects what autogenerate compares against.

**Guard worth adding:** a test asserting every `models/*.py` module is imported in
`models/__init__.py`, so the next model added cannot regress this silently.

## F-02 — Autogenerate drops the main-card uniqueness guarantee

**Table:** `cards`

The DB has the partial unique index that enforces one main card per user:

```sql
CREATE UNIQUE INDEX unique_main_card_per_user ON public.cards
  USING btree (user_id) WHERE ((is_main = true) AND (deleted_at IS NULL));
```

[`models/card.py`](../server/models/card.py) declares only
`UniqueConstraint("card_numb", …)` in `__table_args__` — the partial index is not declared. So
autogenerate emits:

```python
op.drop_index(op.f('unique_main_card_per_user'), table_name='cards',
              postgresql_where='((is_main = true) AND (deleted_at IS NULL))')
```

`context/last-feature.md` explicitly records this index as load-bearing ("Don't add a UNIQUE
constraint over `(user_id, is_main)` — that would block users from having any non-main cards"). The
design decision is documented; the index that implements it is one careless autogenerate away from
deletion, after which nothing stops two main cards per user.

**Fix:** declare it in `Card.__table_args__` so model and DB agree:

```python
Index("unique_main_card_per_user", "user_id", unique=True,
      postgresql_where=text("is_main = true AND deleted_at IS NULL")),
```

**Note:** the DB is already correct. This is a model-side declaration only — no schema change, and
after the fix autogenerate stops proposing the drop.

## F-03 — Card CVC and full card number are persisted in plaintext

**Table:** `cards`

```
cards.card_numb  character varying(32) NOT NULL  -- UNIQUE
cards.cvc        character varying(4)  NOT NULL
```

[`services/card/card.py:138`](../server/services/card/card.py#L138) writes `cvc=payload.cvc`
straight to the row; `last_four` is stored separately, so the full `card_numb` is not needed for
display. CVC is persisted indefinitely with no encryption and no purge.

Storing CVC/CVV after authorization is prohibited outright by PCI-DSS (Req. 3.2) — it is the one data
element that may never be retained, even encrypted. Note this is **not** one of the intentional ToR
deviations: `context/terms-of-reference.md` §5 specifies `card_number_masked` and lists no CVC
column at all, so the schema deviates from its own reference document in the unsafe direction.

I am flagging this rather than proposing a migration, because dropping `cards.cvc` needs a product
decision about the mock-payment flow (does anything validate against it?) and touches
`schemas/card.py` validation plus the add-card UI. Recommended direction: drop `cvc` entirely, and
replace `card_numb` with the masked form the ToR describes — keeping the unique constraint on a hash
if duplicate-card detection is required.

Mitigating context: this is an educational project on a mock payment engine with 16 test cards, no
real cardholder data. That lowers the practical urgency but not the severity of the pattern.

---

# High

## F-04 — 24 indexes exist only in the database, not in any model

Autogenerate proposes dropping every one of these, including the three hottest indexes in the
schema:

| Index | Table | Scans |
|---|---|---|
| `ix_transactions_duplicate_lookup` | `transactions` | 121,572 |
| `idx_transactions_sender_created` | `transactions` | 7,888 |
| `idx_transactions_recipient_created` | `transactions` | 4,557 |
| `idx_requests_status_type` | `requests` | 16,613 |
| `ix_recurring_payments_due` | `recurring_payments` | 8,121 |
| `ix_recurring_payments_user_status` | `recurring_payments` | 2,220 |
| `ix_chat_messages_user_mode` | `chat_messages` | 958 |
| `ix_category_rules_lookup` | `category_rules` | 131 |
| `idx_contacts_owner_user_id` | `contacts` | 120 |
| + 15 more (`biometric_*`, `audit_log_events`, `password_*`, `payment_approval_events`, `user_security_audit_events`, `card_freeze_request_details`, `email_verification_tokens`) | | |

Root cause is the same pattern throughout: these indexes were created by hand-written migrations and
never mirrored into the model `__table_args__`. The models are not the source of truth they are
documented to be, and **autogenerate is currently unusable as a review tool** — its output is 26
lines of destructive noise, which trains reviewers to ignore it. That is what makes F-01 and F-02
dangerous rather than theoretical.

**Fix:** declare each index in its model's `__table_args__`, then confirm autogenerate produces an
empty diff. No DB change; models catch up to reality.

## F-05 — Model FKs omit `ondelete`, so autogenerate silently strips CASCADE

**Tables:** `password_reset_tokens`, `email_verification_tokens`

DB: `password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE`
Model ([`models/password_reset_token.py:13`](../server/models/password_reset_token.py#L13)):
`ForeignKey("users.user_id")` — no `ondelete`.

Autogenerate therefore emits a drop-and-recreate that **loses the cascade**:

```python
op.drop_constraint(op.f('password_reset_tokens_user_id_fkey'), 'password_reset_tokens', type_='foreignkey')
op.create_foreign_key(None, 'password_reset_tokens', 'users', ['user_id'], ['user_id'])
```

Worse than a dropped index: the diff *looks* like a harmless no-op rename (it even leaves the
constraint unnamed), while the delete semantics change from CASCADE to NO ACTION. User deletion then
starts failing on a FK violation from a token table, far from the cause.
`email_verification_token.py` has the identical latent defect (masked today by F-01).

**Fix:** add `ondelete="CASCADE"` to both model FKs to match the DB.

## F-06 — `cards.user_id` has no index

**Table:** `cards`

`cards` has exactly three indexes: the PK, `uq_cards_card_numb`, and the partial main-card index.
There is **no plain index on `user_id`**, yet `Card.user_id` is filtered in **21 repository/service
sites** — "list my cards" is on the dashboard, wallet, payment, settings, and recurring paths.

`pg_stat_user_tables` shows `cards`: **279,796 sequential scans, 4,402,506 rows read** vs 63,514
index scans. Correct plan choice at 16 rows, and the exact query that stops scaling first.

Note the partial index on `(user_id) WHERE is_main AND deleted_at IS NULL` cannot serve general
`WHERE user_id = ?` lookups — its predicate excludes almost every row.

**Proposed fix** (cheap now, 16 rows, no meaningful lock):

```sql
CREATE INDEX ix_cards_user_id ON cards (user_id) WHERE deleted_at IS NULL;
```

Partial on `deleted_at IS NULL` because every list path filters soft-deleted cards out.

## F-07 — FK `ondelete` is inconsistent across user-owned tables

Children of `users` split into two groups with no discernible rule:

**`ON DELETE CASCADE`** — `admin_notification_log`, `biometric_credentials`,
`biometric_registration_challenges`, `biometric_authentication_challenges`, `category_rules`,
`contacts` (both FKs), `email_verification_tokens`, `password_history`, `password_reset_tokens`,
`recurring_payments`, `user_security_audit_events`

**No `ondelete` (defaults to `NO ACTION`)** — `cards`, `chat_messages`, `email_notification_log`,
`requests.requester_user_id`, `requests.target_user_id`, `refund_approval_rules.updated_by_user_id`

**`ON DELETE SET NULL`** — `audit_log_events` (both FKs), `payment_approval_events.actor_user_id`

The three-way split is defensible in principle — audit trails *should* outlive the user
(`SET NULL`), and financial records *should* block deletion (`RESTRICT`/`NO ACTION`). The problem is
that it reads as accidental rather than chosen: `email_notification_log` blocks user deletion while
`admin_notification_log`, its near-twin, cascades. Both are notification dedup logs.

In practice `DELETE FROM users` cannot succeed while any card, chat message, email-log row, or
request references the user — which is masked today because deletion is soft (`users.deleted_at`).
The first hard delete or GDPR erasure request will hit this.

**Recommendation:** document the intended rule (audit → `SET NULL`, financial → `RESTRICT`,
user-private data → `CASCADE`), then align the outliers to it — explicitly, including spelling
`ondelete="RESTRICT"` where `NO ACTION` is what you want, so the intent is legible. I'd class
`email_notification_log` → `CASCADE` as the one clear inconsistency; the rest is a decision to
record, not necessarily to change.

## F-08 — `users.refresh_token`: single plaintext refresh token column

**Table:** `users`

```
users.refresh_token character varying(500) NULL
```

Three problems in one column:

1. **Plaintext storage of a bearer credential.** Every other token in the schema is hashed —
   `password_reset_tokens.token_hash`, `email_verification_tokens.token_hash` (both `varchar(64)`,
   both uniquely indexed). A DB read here yields directly usable refresh tokens.
2. **One token per user**, so a second device login overwrites the first — logout-everywhere is the
   only session model available, and per-device revocation is impossible.
3. **No expiry column**, so validity depends entirely on the JWT's own `exp`; a leaked token cannot
   be revoked without nulling the column and logging the user out everywhere.

**Recommendation:** a `refresh_tokens` table (`user_id`, `token_hash`, `expires_at`, `revoked_at`,
`created_at`, optional device label) following the existing token-table pattern. This is a
feature-sized change touching the auth flow, not a schema tidy — I'd file it separately rather than
fold it into this audit's migrations. Worth noting the ToR (§4) specifies 7-day refresh tokens, which
this column cannot express.

## F-09 — `recurring_payments.status` is free text, not a lookup FK

**Table:** `recurring_payments`

```
recurring_payments.status character varying(20) NOT NULL DEFAULT 'active'
```

Every other status in the schema is a seeded lookup table with an FK: `card_statuses`,
`transaction_statuses`, `request_statuses`, `user_statuses`. This one is a bare string with **no FK,
no CHECK, and no enum** — nothing prevents `'Active'`, `'activ'`, or `'cancelled '` from being
written, and both indexes on the table (`ix_recurring_payments_due`,
`ix_recurring_payments_user_status`) lead with it, so a casing typo silently produces a row that
never matches the scheduler's due query.

Also relevant to `context/last-feature.md`, which notes the model has "only `active`/`cancelled`" and
that Paused/Completed tiles were skipped for lack of data — that limitation lives in this
unconstrained column.

**Proposed fix, cheapest first:**

1. `CHECK (status IN ('active','cancelled'))` — one line, instant on 4 rows, closes the typo hole.
2. Or a `recurring_payment_statuses` lookup + FK, for consistency with the other four.

I recommend (1) now and (2) only if/when paused/completed states are actually added.

## F-22 — The documented apply-on-settle rule is not what the code does

**Added after the audit, on evidence.** This finding invalidates a statement made
elsewhere in this very document (see F-13 below) and in `CLAUDE.md`,
`context/project-overview.md` and `context/project-spec.md`, all of which assert:

> apply balance changes on **settle**, not on create

**The code applies the sender's debit when a transaction is created, and credits
it back if the transaction is later denied.** That is escrow-on-create.

Proven by isolation on a local database seeded to the documented model. A
transaction-processor run that **allowed nothing and denied 95 rows** raised total
card balances by **exactly the sum of those 95 amounts** (25,264.51). With no
settlement occurring, the only possible source of that credit is escrow release.
Confirmed in the opposite direction too: after re-seeding with the sender debited
at create time, settling 60 pending transactions raised total balances by exactly
the escrowed sum (2,724.90) and left the ledger internally consistent.

The mechanics live in [`repositories/card/card.py`](../server/repositories/card/card.py)
(lines ~133-176), which moves value between cards and `users.wallet_balance`
directly; the processor calls into it.

Note the repo already contained the correct statement — `context/current-feature.md`
records under DEMO-FIX that "escrow is apply-on-create". So the documentation
disagrees with *itself*, and the more prominent copies are the wrong ones.

**Why this matters beyond tidiness.** Anyone generating data, writing a migration,
or reasoning about balances from the documented rule will be wrong in a way that
silently creates or destroys money. It did exactly that here: a seed script built
to the documented model minted 25,264.51 out of nothing on the first processor
run, and the error was only visible because total balances were being reconciled
against the ledger.

**Recommended fix — documentation, not code.** The code's behaviour is coherent
and arguably correct (holding funds at authorisation is how real card rails work).
Correct the four documents to describe escrow-on-create, and state explicitly what
each transaction status does to a balance:

| Status | Effect on sender | Effect on recipient |
|---|---|---|
| created → `pending` | debited (escrow held) | none |
| `pending` → `completed` | none (already debited) | credited |
| `pending` → `failed` / `cancelled` | credited back (escrow released) | none |

Do **not** "fix" the code to match the docs without a deliberate decision — that
would change when funds leave a card, which is a product behaviour, not a bug.

---

# Medium

## F-10 — Redundant prefix indexes

A single-column index whose column is the leading column of an existing composite index is dead
weight — the composite already serves those lookups. Three cases:

| Redundant index | Subsumed by |
|---|---|
| `admin_notification_log.ix_admin_notification_log_recipient_user_id` | `uq_admin_notification_recipient_event_ref (recipient_user_id, event_type, reference_id)` |
| `password_history.ix_password_history_user_id` | `ix_password_history_user_id_created_at (user_id, created_at)` |
| `contacts.idx_contacts_owner_user_id` | `uq_contacts_owner_contact (owner_user_id, contact_user_id)` |

Each costs write amplification and space for no read benefit. All three are safe to drop.

**Deliberately not recommended for dropping:** any `uq_*`/`unique_*` index, regardless of
`idx_scan = 0`. Those enforce integrity — scan counts are irrelevant to them, and
`cards.unique_main_card_per_user` shows `scans=0` precisely because it is a constraint, not a lookup
path. More broadly, I have **not** used `idx_scan = 0` as a drop criterion anywhere in this report:
on a dev DB it usually means the feature was never exercised, not that the index is useless.

## F-11 — Missing indexes on FK and filter columns

Unindexed FK columns force a sequential scan on every parent delete and on every join in that
direction:

| Table | Column | Note |
|---|---|---|
| `users` | `status_id`, `user_role_id` | admin list filters by role and status |
| `transactions` | `status_id` | filtered in 12 repository sites |
| `transactions` | `transaction_type_id`, `category_id`, `recurring_payment_id` | history filters; category widget |
| `cards` | `status_id`, `card_type_id` | |
| `recurring_payments` | `sender_card_id`, `recipient_card_id` | `ondelete=RESTRICT` → scanned on every card delete |
| `category_rules` | `category_id` | |
| `payment_approval_events` | `actor_user_id` | |
| `user_security_audit_events` | `created_at`, `event_type` | ordered/filtered on read |

**Explicitly not recommended yet:** `requests.target_user_id`. It has an FK and is nullable, but
grep finds **zero** query sites — the money-request "requests addressed to me" feature is still
unbuilt (`context/current-feature.md` confirms). Add the index with that feature, not before.

Priority order: `transactions.status_id` and `users.(status_id, user_role_id)` first — those back
admin lists and the settle path. The rest are cheap insurance.

## F-12 — `recovery_email_verification_token` breaks the hashing convention

**Table:** `users`

```
users.recovery_email_verification_token character varying(64) NULL
```

`varchar(64)` is exactly the width of the `token_hash` columns in `password_reset_tokens` and
`email_verification_tokens` — the shape says "hash" but
[`repositories/user/auth.py`](../server/repositories/user/auth.py) stores the raw token. Same class
of issue as F-08, smaller blast radius. Storing the hash instead is a contained change: the
verification path is the only reader.

Secondary point: this is four columns inlined on `users`
(`recovery_email_verification_token`, `..._expires_at`, plus `recovery_email`,
`recovery_email_verified_at`) where the schema already has a token-table pattern for exactly this.

## F-13 — No non-negative CHECK on stored balances

`transactions.amount` and `recurring_payments.amount` both carry `CHECK (amount > 0)`. The two
columns that hold *durable* money do not:

```
cards.balance         numeric(12,2) NOT NULL DEFAULT 0.00   -- no CHECK
users.wallet_balance  numeric(12,2) NOT NULL DEFAULT 0      -- no CHECK
```

**Correction:** an earlier draft of this section said "balance changes apply on settle (per the
apply-on-settle rule)". That is wrong — see **F-22**. The debit happens at *create* time, so the
exposure is a bug in either the escrow debit or the escrow release, and a release without a matching
debit inflates a balance rather than driving it negative.

**Verified, then migrated.** No negative balances existed, and `repositories/card/card.py` already
guards with `if from_card.balance < amount: raise` before debiting — so a non-negative constraint
codifies an invariant the code already maintains rather than imposing a new one.

**Resolved in Phase 5:** `ck_cards_balance_non_negative` and
`ck_users_wallet_balance_non_negative` are now in place. Verified non-breaking by re-seeding and
running the transaction processor to completion (38 allowed, 0 negatives, ledger consistent).

## F-14 — `refund_approval_rules` is a singleton with nothing enforcing it

One row (`id = 1`), read via `refund_approval_rules_pkey` and 74 sequential scans. Nothing prevents a
second row, and the service reads one row — so a stray insert changes refund-approval behavior
depending on which row wins.

**Fix:** `CHECK (id = 1)`. One line, instant on one row.

## F-15 — Enum-ish `varchar` columns with no CHECK, and one CSV column

Columns holding a closed set of values with nothing enforcing the set:

| Table | Column | Type |
|---|---|---|
| `chat_messages` | `role` | `varchar(10)` — user/assistant |
| `payment_approval_events` | `event_type` | `varchar(30)` |
| `category_rules` | `match_field` | `varchar(20)` |
| `transactions` | `processed_by` | `varchar(20)` |
| `transactions` | `user_approval_method` | `varchar(20)` |
| `transactions` | `deny_reason_code` | `varchar(50)` |
| `audit_log_events` | `event_type` | `varchar(50)` — indexed, so typos fragment the index |

Separately, **`recurring_payments.months varchar(50)`** stores a comma-separated month list. That is
a denormalized multi-value column: unqueryable in SQL (no month can be filtered without
`LIKE`/string splitting), unconstrained, and order-dependent. It is the one genuine normalization
finding in the schema. Proper shape is a `recurring_payment_months` child table — but with 4 rows and
a working client-side implementation, I'd defer unless month filtering is needed server-side.

CHECK constraints here are cheap and self-documenting; they are also the kind of thing that breaks
tests if a value was silently misspelled somewhere, so add them one at a time.

## F-16 — `users.modified_at` is maintained by hand

The column has `server_default=now()` but **no `onupdate`**, so SQLAlchemy never refreshes it.
Instead ~10 sites in [`repositories/user/auth.py`](../server/repositories/user/auth.py) pass
`modified_at=datetime.now(timezone.utc)` explicitly (lines 197, 273, 291, 303, 317, 337, 363, 390,
547, 556).

It is currently correct — but it is correct by repetition. Any future update path that forgets the
line leaves a stale `modified_at` with no failure.

**Fix:** `onupdate=func.now()` on the model column, then drop the manual assignments. Model-side
only; no schema change. Verify against tests, since a few tests may assert exact timestamps.

---

# Low — flagged, recommend deferring

## F-17 — Naming inconsistencies

> **Superseded.** This finding's "don't act" recommendation was written before the refactor decision to
> move every table into a Postgres schema. Phase 2 of
> [database-refactor-plan.md](database-refactor-plan.md) touches all 31 tables anyway, which makes
> renames near-free *in that one migration* — the condition below ("unless a table is being touched for
> another reason") is now met for every table. See that document's **Naming** section for the full
> pass, including six FK columns that disagree with the PK they reference.

Cosmetic renames on a live schema are high-risk/low-reward (every rename breaks models, repositories,
schemas, and any client field mapping simultaneously). Recorded for awareness; **recommend not
acting** unless a table is being touched for another reason.

| Inconsistency | Detail |
|---|---|
| Lookup PK naming | `user_statuses.id` vs `card_statuses.card_status_id`, `request_statuses.request_status_id`, `transaction_statuses.transaction_status_id` — `user_statuses` is the lone outlier |
| Lookup name column | `user_roles.role_name`, `card_statuses.status_name`, `card_types.type_name` vs `request_types.name`, `request_statuses.name`, `transaction_types.name`, `transaction_categories.name` |
| Updated-timestamp | `users.modified_at` vs `refund_approval_rules.updated_at` |
| `_at` on DATE columns | `cards.expires_at` and `recurring_payments.next_due_at` are `date`, but `_at` reads as timestamp everywhere else. `next_due_at` already caused a real bug (see `last-feature.md` on local vs UTC midnight parsing) |
| Typo | `cards.card_numb` (should be `card_number`) — cannot be renamed without touching F-03's redesign, so fold it in there if F-03 proceeds |
| Row-id naming | `biometric_credentials.credential_row_id` vs `credential_id` (the WebAuthn value) — confusing but deliberate and correct |

## F-18 — `user_roles` is missing `created_at`

Every other lookup table (`card_statuses`, `card_types`, `request_statuses`, `request_types`,
`transaction_statuses`, `transaction_types`, `transaction_categories`, `user_statuses`) has
`created_at timestamptz NOT NULL DEFAULT now()`. `user_roles` has only `role_id` and `role_name`.
Harmless; trivially fixable if the table is touched.

## F-19 — Write-only columns

Set on write, never read back by any repository, service, route, or schema:

| Table | Column | Detail |
|---|---|---|
| `admin_notification_log` | `channel` | Only ever the default `'email'` (`repositories/admin_notification/admin_notification.py:38,50`); never filtered or returned |
| `users` | `app_pin_set_at` | Written on PIN set, nulled on unset (`repositories/user/auth.py:272,316`); never read |
| `biometric_credentials` | `aaguid` | Written at registration (`services/user/auth.py:488`); never read |

All three are plausibly intentional forward-looking metadata (`channel` anticipates SMS/push;
`aaguid` identifies authenticator models). Cost is negligible. **Recommend keeping** — listed for
completeness, since "unused columns" was an explicit audit dimension. `last_run_error`,
`is_discoverable`, and `deny_reason_code` were also checked and *are* read.

## F-20 — `contacts` index naming mismatch

[`models/contact.py:23,26`](../server/models/contact.py#L23-L26) uses `index=True`, which makes
SQLAlchemy generate `ix_contacts_owner_user_id` / `ix_contacts_contact_user_id`, while the migration
created `idx_contacts_*`. Autogenerate churns both every run (drop `idx_*`, create `ix_*`) — pure
noise. Resolves naturally when F-04 declares indexes explicitly; note that per F-10
`idx_contacts_owner_user_id` should be dropped rather than renamed.

## Non-findings, checked

Dropped-column gaps in `pg_attribute` (`users` attnums 27–30, `chat_messages` 6,
`refund_approval_rules` 3) are normal residue of `DROP COLUMN`. No action.

---

# What is right

Worth recording so it does not get "fixed":

- **Money types are uniform.** Every monetary column is `numeric(12,2)` — `transactions.amount`, `cards.balance`, `users.wallet_balance`, `recurring_payments.amount`, `users.payment_confirm_above_amount`. No floats, no mixed precision. This is the dimension most likely to be wrong in a wallet schema, and it is clean.
- **All 60+ timestamp columns are `timestamp with time zone`.** No naive timestamps anywhere.
- **No native PG enums** — every type/status is a seeded lookup table with an FK, consistently.
- **Idempotency is correctly modeled**: `uq_transactions_idempotency_key` on a nullable column, so multiple NULLs are allowed while real keys stay unique. It is the second-hottest index in the schema (37,549 scans).
- **Polymorphic request details are sound**: `refund_request_details` and `card_freeze_request_details` both use `request_id` as PK *and* FK with `ON DELETE CASCADE` — a clean 1:1 that cannot orphan. `uq_refund_request_per_transaction` correctly prevents double refunds on one transaction.
- **No self-FK on `transactions`** — the documented ToR deviation is intact and was not "corrected".
- **`amount > 0` CHECKs** exist on both `transactions` and `recurring_payments`.

---

# Test baseline

`uv run pytest` on `main`, before any change: **30 failed, 327 passed** (354s).

Failures span 12 files — `test_auth_router` (6), `test_request_router` (5),
`test_refund_approval_guard` (4), `test_user_router` (3), `test_transaction_cancel_status` (3),
`test_transaction_staff_lookup` (2), `test_money_amount` (2), and one each in
`test_user_auth_service`, `test_payment_approval`, `test_email_validation`,
`test_card_freeze_request_router`, `test_auth_rate_limit`.

These are **pre-existing** — the working tree had zero tracked modifications when the run was taken.
`context/current-feature.md` records the same pattern historically ("the 18 full-suite failures are
pre-existing local-env issues"), so the count has grown from 18 to 30 and the shared-DB/rate-limit
local-env theory should be re-verified rather than assumed.

**This blocks the acceptance criterion "`uv run pytest` green."** No schema change can be validated
against a red baseline — a fix cannot be distinguished from a pre-existing failure. Recommend
triaging these first, as its own task; several (`test_money_amount`, `test_refund_approval_guard`)
sit close enough to this audit's subject matter that they should be understood before migrating
anything.

---

# Recommended sequencing

**Phase 1 — model-side only, zero DB change, no migration.** Fixes F-01, F-02, F-04, F-05, F-16, F-20
by making the models describe the DB that already exists. The success criterion is
`alembic revision --autogenerate` producing an **empty** diff, which restores autogenerate as a
review tool and retires the whole Critical/High drift class. Nothing to apply, nothing to lock,
fully reversible.

**Phase 2 — additive constraints and indexes, after Phase 1.** F-06 and F-11 (`CREATE INDEX`), F-09
/F-13/F-14 (`CHECK`), F-10 (drop three redundant indexes). All tables are small enough that plain
`CREATE INDEX` is near-instant; for `users`/`transactions` I'd still use `CREATE INDEX CONCURRENTLY`
in a migration with `autocommit_block()` as a habit, since the pooled Supabase connection is shared
and statement timeouts are the failure mode. Each migration reversible and diff-reviewed.

**Phase 3 — needs product decisions, not just review.** F-03 (CVC/PAN storage), F-07 (`ondelete`
policy), F-08 (refresh-token table), F-12, F-15's `months` normalization. Separate tickets.

**Blocked on:** the red test baseline. Phase 1 is safe to do regardless, since it touches no schema —
but I would not apply Phase 2 to the shared DB until the suite is understood.

## Not done, and why

No migrations were written. The task says report first and apply only what is approved, so this
document stops at proposals. Say which phases you want and I'll generate them — Phase 1 needs no
migration at all, and Phase 2 I'd autogenerate then hand-review against the models before anything
touches the shared DB.
