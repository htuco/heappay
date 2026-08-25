"""Seed the local development database with a realistic, high-volume dataset.

Intended for a freshly migrated LOCAL database. Refuses to run against a
non-local host so it can never touch the shared Supabase environment.

Usage (from server/):
    uv run python scripts/seed_dev_data.py

The ledger it produces is internally consistent: balances are derived by
replaying only *completed* transactions in chronological order (apply-on-settle),
and a payment is never emitted if it would overdraw the sender -- so no card or
wallet ends up negative.
"""

from __future__ import annotations

import random
import sys
import unicodedata
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import bcrypt  # noqa: E402
from sqlalchemy import bindparam, insert, inspect as sa_inspect, select, update  # noqa: E402

import models  # noqa: F401,E402  (registers every model on Base.metadata)
from database import Base, engine  # noqa: E402
from models.admin_notification_log import AdminNotificationLog  # noqa: E402
from models.audit_log_event import AuditLogEvent  # noqa: E402
from models.card import Card  # noqa: E402
from models.card_status import CardStatus  # noqa: E402
from models.card_type import CardType  # noqa: E402
from models.card_freeze_request_detail import CardFreezeRequestDetail  # noqa: E402
from models.chat_message import ChatMessage  # noqa: E402
from models.contact import Contact  # noqa: E402
from models.email_notification_log import EmailNotificationLog  # noqa: E402
from models.password_history import PasswordHistory  # noqa: E402
from models.payment_approval_event import PaymentApprovalEvent  # noqa: E402
from models.recurring_payment import RecurringPayment  # noqa: E402
from models.refund_request_detail import RefundRequestDetail  # noqa: E402
from models.request import Request  # noqa: E402
from models.request_status import RequestStatus  # noqa: E402
from models.request_type import RequestType  # noqa: E402
from models.transaction import Transaction  # noqa: E402
from models.transaction_category import TransactionCategory  # noqa: E402
from models.transaction_status import TransactionStatus  # noqa: E402
from models.transaction_type import TransactionType  # noqa: E402
from models.user import User  # noqa: E402
from models.user_role import UserRole  # noqa: E402
from models.user_status import UserStatus  # noqa: E402
from models.user_security_audit_event import UserSecurityAuditEvent  # noqa: E402

RNG = random.Random(20260728)

# Everyone shares this password so any account is usable for manual testing.
SEED_PASSWORD = "Password123!"

PEOPLE: list[tuple[str, str, str]] = [
    # (first, last, role)
    ("Talha", "Zlatar", "admin"),
    ("Hamza", "Tuco", "admin"),
    ("Dino", "Bajramovic", "support"),
    ("Izel", "Repuh", "user"),
    ("Tarik", "Kukuljac", "user"),
    ("Bakir", "Gracić", "user"),
    ("Amar", "Garibovic", "user"),
    ("Ena", "Omerhodžić", "user"),
    ("Arnes", "Rastoder", "user"),
    ("Hamza", "Miladin", "user"),
    ("Jovana", "Samardzic", "user"),
    ("Vildan", "Kadric", "user"),
    ("Ajna", "Mujkić", "user"),
    ("Dželila", "Tinjak", "user"),
    ("Nedim", "Neimarlija", "user"),
    ("Mirza", "Novalic", "user"),
    ("Benjamin", "Pasic", "user"),
    ("Lamija", "Zukan", "user"),
    ("Lamija", "Setic", "user"),
    ("Haris", "Sušić", "user"),
    ("Muhamed", "Hadzalic", "user"),
]

TARGET_TRANSACTIONS = 12000
TARGET_CHAT_MESSAGES = 600
TARGET_AUDIT_EVENTS = 1800

STREETS = [
    "Ferhadija", "Titova", "Zmaja od Bosne", "Alipašina", "Mula Mustafe Bašeskije",
    "Branilaca Sarajeva", "Kranjčevićeva", "Envera Šehovića", "Hamdije Kreševljakovića",
    "Maršala Tita", "Koševo", "Bistrik", "Vilsonovo šetalište",
]
CITIES = ["Sarajevo", "Mostar", "Tuzla", "Zenica", "Banja Luka", "Bihać", "Travnik"]

PAYMENT_NOTES = [
    "Coffee at Ministry of Cejf", "Lunch split", "Rent share", "Groceries — Bingo",
    "Taxi", "Cinema tickets", "Gym membership", "Phone top-up", "Electricity bill",
    "Water bill", "Internet — Telemach", "Netflix share", "Spotify family",
    "Birthday gift", "Concert ticket", "Bookstore", "Pharmacy", "Dentist",
    "Fuel", "Parking", "Bus pass", "Football tickets", "Barber",
    "Flowers", "Bakery", "Butcher", "Hardware store", "Ski pass Bjelašnica",
    "Weekend Trebević", "Airport transfer", "Laptop repair", "Headphones",
]
MERCHANT_NOTES = [
    "Bingo Sarajevo", "Konzum", "Mercator", "dm drogerie", "Telemach",
    "BH Telecom", "Elektroprivreda BiH", "Sarajevogas", "Vodovod",
]

BRAND_PREFIX = ["4", "51", "52", "53", "54", "55", "34", "37", "6011", "35"]


def deaccent(value: str) -> str:
    """ASCII-fold a Bosnian name for use in an email local part."""
    swapped = value.replace("đ", "d").replace("Đ", "D")
    decomposed = unicodedata.normalize("NFKD", swapped)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def db_keys(model, rows: list[dict]) -> list[dict]:
    """Translate attribute-keyed row dicts to DB-column-keyed dicts.

    Core inserts bind parameters by database column *name*, while this script is
    written in terms of ORM attribute names (which Phase 2 deliberately kept
    stable while renaming the underlying columns). Without this translation a
    renamed column is silently omitted from the INSERT.
    """
    # Table.columns is keyed by the *column* key (which defaults to the DB name),
    # so the attribute -> column mapping has to come from the ORM mapper.
    mapping = {
        prop.key: prop.columns[0].name
        for prop in sa_inspect(model).mapper.column_attrs
    }
    return [{mapping.get(k, k): v for k, v in row.items()} for row in rows]


def money(low: float, high: float) -> Decimal:
    return Decimal(str(round(RNG.uniform(low, high), 2)))


def main() -> None:
    url = str(engine.url)
    if not any(host in url for host in ("localhost", "127.0.0.1")):
        raise SystemExit(
            f"Refusing to seed: {engine.url.host!r} is not a local host.\n"
            "This script only runs against a local database."
        )

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=540)

    with engine.begin() as conn:
        # ---------- resolve seeded lookup ids ----------
        # Resolved through the ORM rather than raw SQL so this stays correct
        # regardless of which schema a table lives in or what its columns are
        # named in the database. Attribute names are the stable contract.
        def lookup(model, name_attr: str, pk_attr: str) -> dict[str, int]:
            rows = conn.execute(
                select(getattr(model, name_attr), getattr(model, pk_attr))
            ).all()
            return {r[0]: r[1] for r in rows}

        roles = lookup(UserRole, "role_name", "role_id")
        user_statuses = lookup(UserStatus, "status_name", "id")
        card_statuses = lookup(CardStatus, "status_name", "card_status_id")
        tx_types = lookup(TransactionType, "name", "transaction_type_id")
        tx_statuses = lookup(TransactionStatus, "name", "transaction_status_id")
        req_types = lookup(RequestType, "name", "request_type_id")
        req_statuses = lookup(RequestStatus, "name", "request_status_id")
        card_type_ids = [r[0] for r in conn.execute(select(CardType.card_type_id)).all()]
        category_ids = [
            r[0]
            for r in conn.execute(select(TransactionCategory.transaction_category_id)).all()
        ]

        existing = conn.execute(select(User.user_id).limit(1)).first()
        if existing:
            raise SystemExit(
                "Refusing to seed: users already exist. Drop and re-migrate first."
            )

        # ---------- users ----------
        print(f"hashing {len(PEOPLE)} passwords (bcrypt rounds=12)...", flush=True)
        pw_hash = bcrypt.hashpw(SEED_PASSWORD.encode(), bcrypt.gensalt(rounds=12)).decode()

        seen_emails: set[str] = set()
        user_rows = []
        for i, (first, last, role) in enumerate(PEOPLE):
            local = f"{deaccent(first).lower()}.{deaccent(last).lower()}"
            email = f"{local}@heappay.ba"
            n = 2
            while email in seen_emails:
                email = f"{local}{n}@heappay.ba"
                n += 1
            seen_emails.add(email)
            created = start + timedelta(days=RNG.randint(0, 120), minutes=RNG.randint(0, 1440))
            user_rows.append(
                {
                    "email": email,
                    "first_name": first,
                    "last_name": last,
                    "password_hash": pw_hash,
                    "address": f"{RNG.choice(STREETS)} {RNG.randint(1, 90)}, {RNG.choice(CITIES)}",
                    # Reference data is seeded by migrations; don't assume names.
                    # `i and ...` matters: index 0 would otherwise be suspended,
                    # which silently locks the first account (an admin) out.
                    "status_id": user_statuses.get("suspended", user_statuses["active"])
                    if (i and i % 17 == 0)
                    else user_statuses["active"],
                    "user_role_id": roles[role],
                    "created_at": created,
                    "modified_at": created,
                    "email_verified_at": created + timedelta(minutes=RNG.randint(2, 90)),
                    "wallet_balance": money(0, 400),
                    "is_discoverable": bool(RNG.random() > 0.15),
                    "totp_enabled": bool(RNG.random() > 0.75),
                    "notify_on_user_requests": role in ("admin", "support"),
                    "payment_confirm_above_amount": Decimal(RNG.choice([0, 0, 100, 250, 500])),
                }
            )
        conn.execute(insert(User), db_keys(User, user_rows))
        users = conn.execute(
            select(User.user_id, User.first_name, User.last_name, User.created_at, User.email)
            .order_by(User.user_id)
        ).all()
        print(f"  {len(users)} users", flush=True)

        # ---------- cards ----------
        used_numbers: set[str] = set()

        def card_number() -> str:
            while True:
                prefix = RNG.choice(BRAND_PREFIX)
                num = prefix + "".join(str(RNG.randint(0, 9)) for _ in range(16 - len(prefix)))
                if num not in used_numbers:
                    used_numbers.add(num)
                    return num

        card_rows = []
        for u in users:
            for slot in range(RNG.randint(1, 4)):
                num = card_number()
                # Roughly 1 in 12 cards is soft-deleted; those are never main.
                deleted = RNG.random() < 0.08 and slot > 0
                status = "active"
                if not deleted and RNG.random() < 0.12:
                    non_active = [s for s in ("frozen", "expired", "cancelled") if s in card_statuses]
                    status = RNG.choice(non_active) if non_active else "active"
                card_rows.append(
                    {
                        "user_id": u.user_id,
                        "status_id": card_statuses[status],
                        "card_type_id": RNG.choice(card_type_ids),
                        "card_numb": num,
                        "last_four": num[-4:],
                        "cvc": f"{RNG.randint(100, 999)}",
                        "cardholder_name": f"{deaccent(u.first_name)} {deaccent(u.last_name)}".upper(),
                        "expires_at": date(RNG.randint(2027, 2031), RNG.randint(1, 12), 1),
                        "balance": Decimal("0.00"),
                        "created_at": u.created_at + timedelta(days=RNG.randint(0, 60)),
                        "deleted_at": (now - timedelta(days=RNG.randint(1, 200))) if deleted else None,
                        # Exactly one main card per user, and never a deleted one:
                        # the partial unique index enforces this.
                        "is_main": slot == 0,
                    }
                )
        conn.execute(insert(Card), db_keys(Card, card_rows))
        cards = conn.execute(
            # status_id is labelled explicitly: a bare ORM column select labels the
            # row by DB column name (card_status_id), not the attribute name.
            select(
                Card.card_id,
                Card.user_id,
                Card.status_id.label("status_id"),
                Card.deleted_at,
                Card.created_at,
            ).order_by(Card.card_id)
        ).all()
        print(f"  {len(cards)} cards", flush=True)

        spendable = [c for c in cards if c.deleted_at is None and c.status_id == card_statuses["active"]]
        by_user: dict[int, list] = {}
        for c in cards:
            by_user.setdefault(c.user_id, []).append(c)

        # ---------- transactions (chronological, apply-on-settle) ----------
        balances: dict[int, Decimal] = {c.card_id: Decimal("0.00") for c in cards}
        tx_rows: list[dict] = []

        # Opening deposits so every spendable card has funds.
        for c in spendable:
            amount = money(4000, 40000)
            ts = c.created_at + timedelta(minutes=RNG.randint(5, 600))
            tx_rows.append(
                {
                    "sender_card_id": None,
                    "recipient_card_id": c.card_id,
                    "transaction_type_id": tx_types["deposit"],
                    "status_id": tx_statuses["completed"],
                    "category_id": None,
                    "amount": amount,
                    "note": "Opening deposit",
                    "idempotency_key": str(uuid.uuid4()),
                    "created_at": ts,
                    "processing_eligible_at": ts,
                    "processed_at": ts + timedelta(seconds=RNG.randint(1, 60)),
                    "processed_by": "system",
                    "requires_user_approval": False,
                }
            )
            balances[c.card_id] += amount

        # Peer-to-peer payments spread across the window.
        span = int((now - start).total_seconds())
        pending_pool = []
        while len(tx_rows) < TARGET_TRANSACTIONS:
            src = RNG.choice(spendable)
            dst = RNG.choice(spendable)
            if dst.user_id == src.user_id:
                continue
            amount = money(3, 600)
            ts = start + timedelta(seconds=RNG.randint(0, span))
            # No historical 'pending': the processor resolves anything older than
            # tx_pending_max_age_minutes, so a months-old pending row cannot exist
            # in a live system. Recent pending rows are added separately below.
            roll = RNG.random()
            if roll < 0.90:
                status = "completed"
            elif roll < 0.96:
                status = "failed"
            elif roll < 0.99:
                status = "cancelled"
            else:
                status = "reversed"

            # Apply-on-settle: only a completed payment moves money, and only if
            # the sender can actually cover it.
            if status == "completed":
                if balances[src.card_id] < amount:
                    continue
                balances[src.card_id] -= amount
                balances[dst.card_id] += amount

            note = RNG.choice(PAYMENT_NOTES if RNG.random() < 0.75 else MERCHANT_NOTES)
            row = {
                "sender_card_id": src.card_id,
                "recipient_card_id": dst.card_id,
                "transaction_type_id": tx_types["payment"],
                "status_id": tx_statuses[status],
                "category_id": RNG.choice(category_ids) if RNG.random() < 0.8 else None,
                "amount": amount,
                "note": note,
                "idempotency_key": str(uuid.uuid4()) if RNG.random() < 0.6 else None,
                "created_at": ts,
                "processing_eligible_at": ts,
                "processed_at": (ts + timedelta(seconds=RNG.randint(1, 900)))
                if status in ("completed", "failed", "reversed")
                else None,
                "processed_by": RNG.choice(["system", "auto", "admin"])
                if status != "pending"
                else None,
                "deny_reason_code": RNG.choice(["INSUFFICIENT_FUNDS", "RISK_BLOCK", "USER_DENIED"])
                if status == "failed"
                else None,
                "requires_user_approval": bool(RNG.random() < 0.05),
            }
            tx_rows.append(row)
            if status == "completed" and RNG.random() < 0.02:
                pending_pool.append(len(tx_rows) - 1)

        # A live system always has *recent* pending transactions. Without these
        # every seeded pending row is older than tx_pending_max_age_minutes (24h)
        # and the processor denies them all as PENDING_TIMEOUT_DENY -- which means
        # the settle path never executes and never gets exercised.
        richest = sorted(spendable, key=lambda c: balances[c.card_id], reverse=True)[:15]
        for k in range(60):
            src = richest[k % len(richest)]
            dst = RNG.choice([c for c in spendable if c.user_id != src.user_id])
            # Distinct amounts so the 90s duplicate-detection window can't trip.
            amount = Decimal(str(round(5 + k * 1.37, 2)))
            ts = now - timedelta(minutes=RNG.randint(10, 600))
            tx_rows.append(
                {
                    "sender_card_id": src.card_id,
                    "recipient_card_id": dst.card_id,
                    "transaction_type_id": tx_types["payment"],
                    "status_id": tx_statuses["pending"],
                    "category_id": RNG.choice(category_ids),
                    "amount": amount,
                    "note": RNG.choice(PAYMENT_NOTES),
                    "idempotency_key": str(uuid.uuid4()),
                    "created_at": ts,
                    "processing_eligible_at": ts,
                    "processed_at": None,
                    "processed_by": None,
                    "deny_reason_code": None,
                    "requires_user_approval": False,
                }
            )

        tx_rows.sort(key=lambda r: r["created_at"])
        # executemany binds one compiled statement for the whole batch, so every
        # row must carry an identical key set -- deposits omit some payment-only
        # fields, so fill the union with None before inserting.
        all_keys = set().union(*(r.keys() for r in tx_rows))
        tx_rows = [{k: r.get(k) for k in all_keys} for r in tx_rows]
        print(f"  inserting {len(tx_rows)} transactions...", flush=True)
        for chunk_start in range(0, len(tx_rows), 2000):
            conn.execute(insert(Transaction), db_keys(Transaction, tx_rows[chunk_start : chunk_start + 2000]))

        # Derive balances from the ledger that was actually inserted rather than
        # from the in-memory simulation above. The simulation exists only to stop
        # a payment overdrawing its sender; using it as the source of truth lets
        # any divergence between it and the inserted rows persist silently.
        # Apply-on-settle: only 'completed' rows move money.
        # Read the settled ledger back out and fold it in Python, then write one
        # balance per card by primary key. Deliberately explicit rather than a
        # correlated UPDATE subquery -- easier to verify, and it cannot silently
        # de-correlate and give every card the same total.
        # The application debits the sender when a transaction is CREATED (escrow
        # held) and credits it back if the transaction is later denied -- verified
        # empirically: a processor run that allowed nothing and denied 95 rows
        # raised total card balances by exactly the sum of those 95 amounts.
        # So a pending outgoing transaction must already be debited here, or the
        # first processor run mints money out of nowhere.
        ledger = conn.execute(
            select(
                Transaction.recipient_card_id.label("rcpt"),
                Transaction.sender_card_id.label("sndr"),
                Transaction.amount.label("amt"),
                TransactionStatus.name.label("status"),
            )
            .join(
                TransactionStatus,
                TransactionStatus.transaction_status_id == Transaction.status_id,
            )
            .where(TransactionStatus.name.in_(("completed", "pending")))
        ).all()

        net: dict[int, Decimal] = {c.card_id: Decimal("0.00") for c in cards}
        for row in ledger:
            if row.sndr is not None:
                # Debited on create for pending, and on settle for completed.
                net[row.sndr] = net.get(row.sndr, Decimal("0.00")) - row.amt
            if row.status == "completed":
                # Only a settled transaction credits the recipient.
                net[row.rcpt] = net.get(row.rcpt, Decimal("0.00")) + row.amt

        conn.execute(
            update(Card.__table__)
            .where(Card.card_id == bindparam("b_card_id"))
            .values(balance=bindparam("b_balance")),
            [{"b_card_id": cid, "b_balance": bal} for cid, bal in net.items()],
        )
        print(f"  balances applied to {len(balances)} cards", flush=True)

        completed_tx = conn.execute(
            select(Transaction.transaction_id, Transaction.recipient_card_id, Transaction.sender_card_id)
            .where(Transaction.status_id == tx_statuses["completed"])
            .where(Transaction.sender_card_id.isnot(None))
            .limit(400)
        ).all()

        # ---------- contacts ----------
        contact_rows = []
        pairs: set[tuple[int, int]] = set()
        for u in users:
            others = [o for o in users if o.user_id != u.user_id]
            for other in RNG.sample(others, RNG.randint(3, 9)):
                key = (u.user_id, other.user_id)
                if key in pairs:
                    continue
                pairs.add(key)
                contact_rows.append(
                    {
                        "owner_user_id": u.user_id,
                        "contact_user_id": other.user_id,
                        "alias": other.first_name if RNG.random() < 0.4 else None,
                        "is_favorite": bool(RNG.random() < 0.25),
                        "created_at": now - timedelta(days=RNG.randint(1, 400)),
                    }
                )
        conn.execute(insert(Contact), db_keys(Contact, contact_rows))
        print(f"  {len(contact_rows)} contacts", flush=True)

        # ---------- recurring payments ----------
        rec_rows = []
        for _ in range(40):
            src = RNG.choice(spendable)
            dst = RNG.choice([c for c in spendable if c.user_id != src.user_id])
            cancelled = RNG.random() < 0.2
            day = RNG.randint(1, 28)
            rec_rows.append(
                {
                    "user_id": src.user_id,
                    "sender_card_id": src.card_id,
                    "recipient_card_id": dst.card_id,
                    "amount": money(15, 400),
                    "day_of_month": day,
                    "note": RNG.choice(["Rent", "Internet", "Gym", "Netflix", "Loan repayment", "Savings"]),
                    "status": "cancelled" if cancelled else "active",
                    "next_due_at": date(now.year, now.month, day)
                    if day > now.day
                    else (date(now.year + (now.month == 12), (now.month % 12) + 1, day)),
                    "last_run_failed": bool(RNG.random() < 0.12),
                    "last_run_error": "Insufficient funds" if RNG.random() < 0.12 else None,
                    "created_at": now - timedelta(days=RNG.randint(30, 400)),
                    "cancelled_at": (now - timedelta(days=RNG.randint(1, 30))) if cancelled else None,
                    "months": None,
                }
            )
        conn.execute(insert(RecurringPayment), db_keys(RecurringPayment, rec_rows))
        print(f"  {len(rec_rows)} recurring payments", flush=True)

        # ---------- requests (refund / money_request / card_freeze) ----------
        request_rows = []
        refund_targets = RNG.sample(completed_tx, min(70, len(completed_tx)))
        for tx in refund_targets:
            owner = next(c for c in cards if c.card_id == tx.sender_card_id)
            st = RNG.choice(["pending", "approved", "declined", "cancelled"])
            request_rows.append(
                {
                    "_kind": "refund",
                    "_transaction_id": tx.transaction_id,
                    "request_type_id": req_types["refund"],
                    "request_status_id": req_statuses[st],
                    "requester_user_id": owner.user_id,
                    "target_user_id": None,
                    "note": RNG.choice(["Wrong amount", "Duplicate charge", "Item never arrived", "Fraud"]),
                    "created_at": now - timedelta(days=RNG.randint(1, 200)),
                    "resolved_at": (now - timedelta(days=RNG.randint(0, 30))) if st != "pending" else None,
                }
            )
        for _ in range(50):
            a, b = RNG.sample(users, 2)
            st = RNG.choice(["pending", "approved", "declined"])
            request_rows.append(
                {
                    "_kind": "money_request",
                    "request_type_id": req_types["money_request"],
                    "request_status_id": req_statuses[st],
                    "requester_user_id": a.user_id,
                    "target_user_id": b.user_id,
                    "note": RNG.choice(["Dinner last night", "Taxi share", "Concert ticket", "Lunch"]),
                    "created_at": now - timedelta(days=RNG.randint(1, 120)),
                    "resolved_at": (now - timedelta(days=RNG.randint(0, 20))) if st != "pending" else None,
                }
            )
        freeze_cards = RNG.sample(cards, 30)
        for c in freeze_cards:
            st = RNG.choice(["pending", "approved", "declined"])
            request_rows.append(
                {
                    "_kind": "card_freeze",
                    "_card_id": c.card_id,
                    "request_type_id": req_types["card_freeze"],
                    "request_status_id": req_statuses[st],
                    "requester_user_id": c.user_id,
                    "target_user_id": None,
                    "note": RNG.choice(["Card lost", "Suspicious activity", "Travelling"]),
                    "created_at": now - timedelta(days=RNG.randint(1, 150)),
                    "resolved_at": (now - timedelta(days=RNG.randint(0, 20))) if st != "pending" else None,
                }
            )

        clean = [{k: v for k, v in r.items() if not k.startswith("_")} for r in request_rows]
        conn.execute(insert(Request), db_keys(Request, clean))
        new_requests = conn.execute(select(Request.request_id).order_by(Request.request_id)).all()
        ids = [r[0] for r in new_requests]

        refund_details, freeze_details = [], []
        claimed_tx: set[int] = set()
        for rid, meta in zip(ids, request_rows):
            if meta["_kind"] == "refund" and meta["_transaction_id"] not in claimed_tx:
                claimed_tx.add(meta["_transaction_id"])
                refund_details.append(
                    {
                        "request_id": rid,
                        "transaction_id": meta["_transaction_id"],
                        "reason_code": RNG.choice(["WRONG_AMOUNT", "DUPLICATE", "NOT_RECEIVED", "FRAUD"]),
                    }
                )
            elif meta["_kind"] == "card_freeze":
                freeze_details.append({"request_id": rid, "card_id": meta["_card_id"]})
        if refund_details:
            conn.execute(insert(RefundRequestDetail), db_keys(RefundRequestDetail, refund_details))
        if freeze_details:
            conn.execute(insert(CardFreezeRequestDetail), db_keys(CardFreezeRequestDetail, freeze_details))
        print(
            f"  {len(clean)} requests ({len(refund_details)} refund, {len(freeze_details)} freeze details)",
            flush=True,
        )

        # ---------- chat, audit, notifications, password history ----------
        chat_rows = []
        prompts = [
            "How much did I spend on groceries last month?",
            "Show my pending transactions",
            "Freeze my main card",
            "What is my current balance?",
            "Send 50 KM to Tarik",
            "Why did my payment fail?",
        ]
        replies = [
            "You spent 412.60 KM on groceries in the last 30 days.",
            "You have 3 pending transactions totalling 187.20 KM.",
            "I can help with that — which card should I freeze?",
            "Your available balance is 1,204.55 KM across 2 active cards.",
        ]
        for _ in range(TARGET_CHAT_MESSAGES // 2):
            u = RNG.choice(users)
            ts = now - timedelta(days=RNG.randint(0, 90), minutes=RNG.randint(0, 1440))
            agent = bool(RNG.random() < 0.35)
            chat_rows.append(
                {"user_id": u.user_id, "role": "user", "content": RNG.choice(prompts),
                 "agent_mode": agent, "created_at": ts}
            )
            chat_rows.append(
                {"user_id": u.user_id, "role": "model", "content": RNG.choice(replies),
                 "agent_mode": agent, "created_at": ts + timedelta(seconds=RNG.randint(1, 20))}
            )
        conn.execute(insert(ChatMessage), db_keys(ChatMessage, chat_rows))

        audit_rows = []
        event_types = [
            "user.login", "user.logout", "user.login_failed", "card.created", "card.frozen",
            "card.deleted", "transaction.created", "transaction.settled", "transaction.cancelled",
            "request.refund.approved", "request.refund.declined", "admin.user_status_changed",
            "admin.role_changed",
        ]
        staff = [u for u in users if u.email.startswith(("talha", "hamza.tuco", "dino"))]
        for _ in range(TARGET_AUDIT_EVENTS):
            actor = RNG.choice(users)
            et = RNG.choice(event_types)
            audit_rows.append(
                {
                    "event_type": et,
                    "actor_user_id": (RNG.choice(staff).user_id if staff else actor.user_id)
                    if et.startswith("admin.")
                    else actor.user_id,
                    "target_user_id": RNG.choice(users).user_id if et.startswith("admin.") else None,
                    "resource_type": et.split(".")[0],
                    "resource_id": str(RNG.randint(1, 5000)),
                    "detail": None if RNG.random() < 0.6 else f"{et} via web",
                    "ip_address": f"{RNG.randint(31,213)}.{RNG.randint(0,255)}.{RNG.randint(0,255)}.{RNG.randint(1,254)}",
                    "created_at": now - timedelta(days=RNG.randint(0, 500), minutes=RNG.randint(0, 1440)),
                }
            )
        conn.execute(insert(AuditLogEvent), db_keys(AuditLogEvent, audit_rows))

        sec_rows = []
        for _ in range(300):
            u = RNG.choice(users)
            sec_rows.append(
                {
                    "user_id": u.user_id,
                    "event_type": RNG.choice(
                        ["password_changed", "totp_enabled", "totp_disabled", "pin_set",
                         "pin_failed", "recovery_email_set", "biometric_registered"]
                    ),
                    "detail": None,
                    "created_at": now - timedelta(days=RNG.randint(0, 400)),
                }
            )
        conn.execute(insert(UserSecurityAuditEvent), db_keys(UserSecurityAuditEvent, sec_rows))

        pw_rows = []
        for u in users:
            for k in range(RNG.randint(0, 3)):
                pw_rows.append(
                    {
                        "user_id": u.user_id,
                        "password_hash": pw_hash,
                        "created_at": now - timedelta(days=RNG.randint(30, 500) + k * 30),
                    }
                )
        if pw_rows:
            conn.execute(insert(PasswordHistory), db_keys(PasswordHistory, pw_rows))

        notif_rows, seen_notif = [], set()
        for tx in completed_tx[:250]:
            owner = next(c for c in cards if c.card_id == tx.sender_card_id)
            et = RNG.choice(["payment_sent", "payment_received", "outflow_alert", "topup"])
            key = (owner.user_id, et, str(tx.transaction_id))
            if key in seen_notif:
                continue
            seen_notif.add(key)
            notif_rows.append(
                {
                    "user_id": owner.user_id,
                    "event_type": et,
                    "reference_id": str(tx.transaction_id),
                    "sent_at": now - timedelta(days=RNG.randint(0, 120)),
                }
            )
        if notif_rows:
            conn.execute(insert(EmailNotificationLog), db_keys(EmailNotificationLog, notif_rows))

        admin_notif, seen_admin = [], set()
        for rid in ids[:60]:
            recipient = RNG.choice(staff) if staff else RNG.choice(users)
            key = (recipient.user_id, "refund_requested", str(rid))
            if key in seen_admin:
                continue
            seen_admin.add(key)
            admin_notif.append(
                {
                    "recipient_user_id": recipient.user_id,
                    "recipient_email": recipient.email,
                    "event_type": "refund_requested",
                    "reference_id": str(rid),
                    "channel": "email",
                    "sent_at": now - timedelta(days=RNG.randint(0, 100)),
                }
            )
        if admin_notif:
            conn.execute(insert(AdminNotificationLog), db_keys(AdminNotificationLog, admin_notif))

        approval_rows = []
        for tx in completed_tx[:120]:
            ts = now - timedelta(days=RNG.randint(0, 100))
            approval_rows.append(
                {
                    "transaction_id": tx.transaction_id,
                    "event_type": RNG.choice(["approval_requested", "approved", "denied", "expired"]),
                    "actor_user_id": RNG.choice(users).user_id,
                    "verification_method": RNG.choice(["pin", "totp", "biometric", None]),
                    "detail": None,
                    "created_at": ts,
                }
            )
        conn.execute(insert(PaymentApprovalEvent), db_keys(PaymentApprovalEvent, approval_rows))

        print(
            f"  {len(chat_rows)} chat, {len(audit_rows)} audit, {len(sec_rows)} security events, "
            f"{len(pw_rows)} password history, {len(notif_rows)} email log, "
            f"{len(admin_notif)} admin log, {len(approval_rows)} approval events",
            flush=True,
        )

    print(f"\nDone. Every account uses the password: {SEED_PASSWORD}")


if __name__ == "__main__":
    main()
