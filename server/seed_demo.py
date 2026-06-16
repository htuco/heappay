"""Seed demo accounts + data for the showcase.

Idempotent: re-running deletes the demo users (by email) and their cards /
transactions / requests, then recreates everything fresh. Resolves all
reference ids by name so it works on any environment.

Run from server/:  uv run python seed_demo.py
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import bcrypt
from sqlalchemy import select, text

from database import SessionLocal
from models.card import Card
from models.card_freeze_request_detail import CardFreezeRequestDetail
from models.refund_request_detail import RefundRequestDetail
from models.request import Request
from models.transaction import Transaction
from models.user import User

PASSWORD = "Demo1234!"

TEAM = [
    ("talha@heap.demo", "Talha", "Heap"),
    ("arnes@heap.demo", "Arnes", "Heap"),
    ("izel@heap.demo", "Izel", "Heap"),
    ("dzelila@heap.demo", "Dzelila", "Heap"),
    ("hamza@heap.demo", "Hamza", "Heap"),
]

DEMO_EMAILS = [
    "admin@heap.demo",
    "support@heap.demo",
    "amir@heap.demo",
    "lejla@heap.demo",
] + [e for e, _, _ in TEAM]


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def _id(db, table, name_col, pk_col, name):
    row = db.execute(
        text(f"SELECT {pk_col} FROM {table} WHERE {name_col} = :n"), {"n": name}
    ).scalar_one_or_none()
    if row is None:
        raise SystemExit(f"Missing reference row: {table}.{name_col} = {name!r}")
    return row


def _purge(db):
    """Remove existing demo users and everything that hangs off them."""
    ids = [
        r[0]
        for r in db.execute(
            select(User.user_id).where(User.email.in_(DEMO_EMAILS))
        ).all()
    ]
    if not ids:
        return
    card_ids = [
        r[0]
        for r in db.execute(select(Card.card_id).where(Card.user_id.in_(ids))).all()
    ]
    # request details -> requests (by requester or by referenced card/tx)
    tx_ids = [
        r[0]
        for r in db.execute(
            select(Transaction.transaction_id).where(
                Transaction.sender_card_id.in_(card_ids)
                | Transaction.recipient_card_id.in_(card_ids)
            )
        ).all()
    ]
    req_ids = [
        r[0]
        for r in db.execute(
            select(Request.request_id).where(Request.requester_user_id.in_(ids))
        ).all()
    ]
    if req_ids:
        db.execute(text("DELETE FROM refund_request_details WHERE request_id = ANY(:r)"), {"r": req_ids})
        db.execute(text("DELETE FROM card_freeze_request_details WHERE request_id = ANY(:r)"), {"r": req_ids})
        db.execute(text("DELETE FROM requests WHERE request_id = ANY(:r)"), {"r": req_ids})
    if tx_ids:
        db.execute(text("DELETE FROM transactions WHERE transaction_id = ANY(:t)"), {"t": tx_ids})
    if card_ids:
        db.execute(text("DELETE FROM cards WHERE card_id = ANY(:c)"), {"c": card_ids})
    db.execute(text("DELETE FROM users WHERE user_id = ANY(:u)"), {"u": ids})
    db.commit()


def _make_user(db, *, email, first, last, role_id, active_status_id):
    u = User(
        email=email,
        first_name=first,
        last_name=last,
        password_hash=_hash(PASSWORD),
        status_id=active_status_id,
        user_role_id=role_id,
    )
    db.add(u)
    db.flush()
    return u


def _make_card(db, *, user, number, holder, status_id, type_id, balance, is_main):
    c = Card(
        user_id=user.user_id,
        status_id=status_id,
        card_type_id=type_id,
        card_numb=number,
        last_four=number[-4:],
        cvc="123",
        cardholder_name=holder,
        expires_at=date(2030, 12, 31),
        balance=Decimal(balance),
        is_main=is_main,
    )
    db.add(c)
    db.flush()
    return c


def main():
    db = SessionLocal()
    try:
        _purge(db)

        # reference ids by name
        admin_role = _id(db, "user_roles", "role_name", "role_id", "admin")
        support_role = _id(db, "user_roles", "role_name", "role_id", "support")
        user_role = _id(db, "user_roles", "role_name", "role_id", "user")
        active_user = _id(db, "user_statuses", "status_name", "id", "active")
        active_card = _id(db, "card_statuses", "status_name", "card_status_id", "active")
        frozen_card = _id(db, "card_statuses", "status_name", "card_status_id", "frozen")
        visa_debit = db.execute(
            text("SELECT card_type_id FROM card_types WHERE type_name='debit' AND vendor='visa' LIMIT 1")
        ).scalar_one()
        mc_credit = db.execute(
            text("SELECT card_type_id FROM card_types WHERE type_name='credit' AND vendor='mastercard' LIMIT 1")
        ).scalar_one()
        tx_payment = _id(db, "transaction_types", "name", "transaction_type_id", "payment")
        tx_completed = _id(db, "transaction_statuses", "name", "transaction_status_id", "completed")
        tx_pending = _id(db, "transaction_statuses", "name", "transaction_status_id", "pending")
        req_pending = _id(db, "request_statuses", "name", "request_status_id", "pending")
        refund_type = _id(db, "request_types", "name", "request_type_id", "refund")
        freeze_type = _id(db, "request_types", "name", "request_type_id", "card_freeze")

        # ── accounts ──────────────────────────────────────────────────────────
        _make_user(db, email="admin@heap.demo", first="Adna", last="Admin",
                   role_id=admin_role, active_status_id=active_user)
        _make_user(db, email="support@heap.demo", first="Selma", last="Support",
                   role_id=support_role, active_status_id=active_user)
        amir = _make_user(db, email="amir@heap.demo", first="Amir", last="Hadzic",
                          role_id=user_role, active_status_id=active_user)
        lejla = _make_user(db, email="lejla@heap.demo", first="Lejla", last="Begic",
                           role_id=user_role, active_status_id=active_user)

        # ── cards ─────────────────────────────────────────────────────────────
        amir_main = _make_card(db, user=amir, number="4111111111111111", holder="AMIR HADZIC",
                               status_id=active_card, type_id=visa_debit, balance="1250.00", is_main=True)
        _make_card(db, user=amir, number="5555444433332222", holder="AMIR HADZIC",
                   status_id=active_card, type_id=mc_credit, balance="300.00", is_main=False)
        # a frozen secondary card so the unfreeze flow is demoable
        amir_frozen = _make_card(db, user=amir, number="4222222222222220", holder="AMIR HADZIC",
                                 status_id=frozen_card, type_id=visa_debit, balance="80.00", is_main=False)

        lejla_main = _make_card(db, user=lejla, number="4012888888881881", holder="LEJLA BEGIC",
                                status_id=active_card, type_id=visa_debit, balance="640.00", is_main=True)
        _make_card(db, user=lejla, number="5105105105105100", holder="LEJLA BEGIC",
                   status_id=active_card, type_id=mc_credit, balance="150.00", is_main=False)

        db.flush()

        # ── transactions (completed history Amir <-> Lejla) ───────────────────
        now = datetime.now(timezone.utc)

        def tx(sender, recipient, amount, status_id, days_ago, note):
            t = Transaction(
                sender_card_id=sender.card_id,
                recipient_card_id=recipient.card_id,
                transaction_type_id=tx_payment,
                status_id=status_id,
                amount=Decimal(amount),
                note=note,
                created_at=now - timedelta(days=days_ago),
                processing_eligible_at=now - timedelta(days=days_ago),
            )
            db.add(t)
            db.flush()
            return t

        completed_tx = tx(amir_main, lejla_main, "120.00", tx_completed, 6, "Rucak i kafa")
        tx(lejla_main, amir_main, "45.50", tx_completed, 4, "Karte za kino")
        tx(amir_main, lejla_main, "200.00", tx_completed, 2, "Stanarina dio")
        # one pending so the soft-delete guard + processor have something live
        tx(lejla_main, amir_main, "30.00", tx_pending, 0, "Na cekanju")

        # ── a pending REFUND request (Amir wants 120 back) ────────────────────
        refund = Request(
            request_type_id=refund_type,
            request_status_id=req_pending,
            requester_user_id=amir.user_id,
            note="Dvostruko naplaceno",
            created_at=now - timedelta(days=1),
        )
        db.add(refund)
        db.flush()
        db.add(RefundRequestDetail(request_id=refund.request_id, transaction_id=completed_tx.transaction_id))

        # ── a pending FREEZE request (Lejla wants her main card frozen) ───────
        freeze = Request(
            request_type_id=freeze_type,
            request_status_id=req_pending,
            requester_user_id=lejla.user_id,
            note="Izgubila sam karticu",
            created_at=now - timedelta(hours=5),
        )
        db.add(freeze)
        db.flush()
        db.add(CardFreezeRequestDetail(request_id=freeze.request_id, card_id=lejla_main.card_id))

        # ── Heap team (basic users) with cards + transfers among themselves ───
        team_members = []
        for i, (email, first, last) in enumerate(TEAM):
            m = _make_user(db, email=email, first=first, last=last,
                           role_id=user_role, active_status_id=active_user)
            # unique 16-digit number, distinct from the demo cards above
            num = f"49000000000{i + 1:05d}"
            card = _make_card(db, user=m, number=num, holder=f"{first.upper()} {last.upper()}",
                              status_id=active_card, type_id=visa_debit,
                              balance="500.00", is_main=True)
            team_members.append((m, card))
        db.flush()

        # round-robin completed transfers: each member pays the next one
        n = len(team_members)
        for i, (_, card) in enumerate(team_members):
            _, recipient_card = team_members[(i + 1) % n]
            tx(card, recipient_card, f"{25 + i * 5}.00", tx_completed, 3 - (i % 3),
               f"Heap team transfer #{i + 1}")

        db.commit()

        print("Seed complete. Accounts (password: %s):" % PASSWORD)
        print("  admin@heap.demo    (admin)")
        print("  support@heap.demo  (support)")
        print("  amir@heap.demo     (user)  — 3 cards (1 frozen), history, pending refund")
        print("  lejla@heap.demo    (user)  — 2 cards, history, pending freeze request")
    finally:
        db.close()


if __name__ == "__main__":
    main()
