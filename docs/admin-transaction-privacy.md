# Admin transaction privacy

## Policy

Admins operate the platform but must not see end-user monetary amounts. Support staff retain full amount visibility for dispute resolution and refunds.

| Role    | Transaction metadata (id, user, status, date, type) | Amounts / volume |
|---------|-----------------------------------------------------|------------------|
| User    | Own transactions only                               | Yes (own only)   |
| Support | All users                                         | Yes              |
| Admin   | All users                                         | **No**           |

## API behavior

Responses include explicit privacy flags so clients never infer amounts from missing fields alone:

- `amount: null` and `amount_hidden: true` on `TransactionResponse` when masked.
- `amounts_hidden: true`, `completed_volume: null`, and per-month `volume_hidden: true` on admin stats.
- `transaction_amount: null` and `transaction_amount_hidden: true` on staff refund request details for admins.

### Masked routes (admin)

- `GET /transactions/all` — always masked (`require_admin`).
- `GET /transactions/stats` — counts only; volume fields nulled.
- `GET /transactions/user/{id}` — masked when caller is admin.
- `GET /transactions/{id}/staff` — masked when caller is admin.
- `PATCH /transactions/{id}/staff` — response masked when caller is admin.
- Staff refund request list/detail/approve/decline — refund `transaction_amount` masked when caller is admin.

### Unmasked routes

- User endpoints (`GET /transactions`, summaries, etc.) — unchanged.
- All staff routes when the caller has the **support** role.

Implementation: `server/utils/transaction_privacy.py` and `get_user_context().is_admin` in staff handlers.

## Admin UI

Admin surfaces render **Hidden** instead of currency when `amount_hidden` / `amounts_hidden` / `transaction_amount_hidden` is set:

- All Transactions panel (amount column; amount sort removed).
- Platform Activity insights (volume KPI and chart switch to counts when volumes are hidden).
- User details (transactions and refund activity tabs).
- Refund request queue and review dialog.

Support UI is unchanged and continues to show dollar amounts.

## Admin chat

The admin assistant system prompt omits transaction euro amounts from injected context. Amounts appear as `[amount hidden]` in transaction listings.
