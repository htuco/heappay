# Wallet vs. card balance

## Model

A user's money lives in two kinds of place:

| Holding        | Field                | Meaning                                                        | Can spend? |
|----------------|----------------------|----------------------------------------------------------------|------------|
| **Wallet**     | `users.wallet_balance` | Unallocated funds — money not on any card                     | No         |
| **Card**       | `cards.balance`      | Funds on a specific card (already net of escrow/reserved holds) | Yes        |

The **Total Balance** shown in the app is `wallet_balance + Σ card.balance`. The
two parts are always surfaced separately so the user can see the split at a
glance (dashboard breakdown chips, wallet balance panel).

The wallet is a **holding pool**; cards are the only instrument that can spend.
This keeps the card-centric payment/escrow/refund engine untouched.

## Money flow

```
Nexus / FEP top-up ──▶ CARD ──(spend / send)──▶ out
                        │  ▲
             card→wallet │  │ wallet→card
                        ▼  │
                       WALLET  (unallocated holding pool)
```

- **Incoming funds** (Nexus top-up, deposits) land on a **card** via the existing
  deposit flow — they are recorded in the transaction ledger with a recipient card.
- **Spending / sending** always happens **from a card**.
- **Wallet ↔ card** movements are internal reallocation (see below).

> Funding intentionally lands on a card rather than the wallet: a wallet deposit
> has no recipient card, and `transactions.recipient_card_id` is `NOT NULL`
> (required for idempotency + notifications). Redirecting funding into the wallet
> would mean changing that core, escrow-aware table — out of scope here. Users
> move top-ups into the wallet with a card→wallet transfer if they want.

## Transfers (wallet ↔ card)

`POST /wallet/transfers` moves money between the wallet and one of the user's cards.

| Field       | Values                        |
|-------------|-------------------------------|
| `direction` | `to_card` (wallet → card) or `to_wallet` (card → wallet) |
| `card_id`   | The card involved             |
| `amount`    | Positive, ≤ 2 decimals        |

Rules enforced server-side (`WalletService`):

- The card must exist and **belong to the requesting user** (else 403/404).
- A **frozen** card cannot move money in or out (409).
- The **source** must have enough balance — wallet for `to_card`, card for
  `to_wallet` (else 409).
- Amount must be positive (else 422).

Both sides update **atomically** under row locks (`SELECT … FOR UPDATE` on the
user row and the card row), so concurrent transfers cannot race.

`GET /wallet` returns the current `wallet_balance`.

### Ledger note

Wallet ↔ card transfers are **balance operations only** — they do not write a row
to the card-centric `transactions` ledger (which requires both a sender and a
`NOT NULL` recipient card). They are instant and reflected immediately in
balances. If transfer history is needed later, add a dedicated `wallet_ledger`
table rather than loosening the core `transactions` schema.

## Backend map

| Concern            | Location                                                        |
|--------------------|-----------------------------------------------------------------|
| Column             | `users.wallet_balance` (`server/models/user.py`), migration `t1u2v3w4x5y6` |
| Wallet credit/debit | `UserRepository.credit_wallet` / `debit_wallet`                |
| Wallet ↔ card      | `CardRepository.transfer_wallet_to_card` / `transfer_card_to_wallet` |
| Service            | `server/services/wallet/wallet.py` (`WalletService`)            |
| Routes             | `server/routes/wallet/wallet.py` (`GET /wallet`, `POST /wallet/transfers`) |

## Frontend map

| Concern              | Location                                                     |
|----------------------|-------------------------------------------------------------|
| API client           | `client/src/services/walletService.js`                      |
| Balance + transfer   | `client/src/hooks/useWallet.js`                             |
| Total incl. wallet   | `client/src/hooks/useTotalBalance.js` (`walletBalance`, `cardsBalance`) |
| Dashboard breakdown  | `client/src/components/dashboard/TotalBalanceWidget.jsx`     |
| Wallet panel         | `client/src/components/wallet/WalletBalanceCard.jsx`         |
| Transfer modal       | `client/src/components/wallet/WalletTransferModal.jsx`       |
