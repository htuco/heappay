"""End-to-end money-request flow against a real SQLite schema.

The existing guard/router tests use fakes. These hit the real repository,
service, and routes so a broken create/list/pay/decline path fails here.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
import os

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

import models  # noqa: E402,F401
from database import Base, SQLITE_SCHEMA_TRANSLATE_MAP, get_db  # noqa: E402
from main import create_app  # noqa: E402
from models.card import Card  # noqa: E402
from models.card_status import CardStatus  # noqa: E402
from models.card_type import CardType  # noqa: E402
from models.email_verification_token import EmailVerificationToken  # noqa: E402,F401
from models.money_request_detail import MoneyRequestDetail  # noqa: E402
from models.request import Request  # noqa: E402
from models.request_status import RequestStatus  # noqa: E402
from models.request_type import RequestType  # noqa: E402
from models.transaction import Transaction  # noqa: E402
from models.transaction_status import TransactionStatus  # noqa: E402
from models.transaction_type import TransactionType  # noqa: E402
from models.user import User  # noqa: E402
from models.user_role import UserRole  # noqa: E402
from models.user_status import UserStatus  # noqa: E402
from routes.dependencies import require_verified_user  # noqa: E402

_AMOUNT = "12.50"


def _session() -> Session:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    ).execution_options(schema_translate_map=SQLITE_SCHEMA_TRANSLATE_MAP)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    db.add(UserStatus(status_name="active"))
    db.add(UserRole(role_name="user"))
    db.add(CardStatus(status_name="active"))
    db.add(CardType(type_name="debit", vendor="visa"))
    db.add(RequestType(name="money_request"))
    db.add(RequestStatus(name="pending"))
    db.add(RequestStatus(name="approved"))
    db.add(RequestStatus(name="declined"))
    db.add(TransactionType(name="payment"))
    db.add(TransactionStatus(name="pending"))
    db.commit()
    return db


def _user(db: Session, *, email: str, first: str, last: str) -> User:
    now = datetime.now(timezone.utc)
    user = User(
        email=email,
        first_name=first,
        last_name=last,
        password_hash="hashed",
        status_id=1,
        user_role_id=1,
        email_verified_at=now,
        payment_confirm_enabled=False,
        totp_enabled=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _card(db: Session, *, user_id: int, number: str, balance: str, is_main: bool = True) -> Card:
    card = Card(
        user_id=user_id,
        status_id=1,
        card_type_id=1,
        card_numb=number,
        last_four=number[-4:],
        cvc="123",
        expires_at=date(2030, 12, 31),
        balance=Decimal(balance),
        is_main=is_main,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


def _pair(db: Session) -> tuple[User, Card, User, Card]:
    requester = _user(db, email="ada@example.com", first="Ada", last="Lovelace")
    target = _user(db, email="alan@example.com", first="Alan", last="Turing")
    requester_card = _card(db, user_id=requester.user_id, number="4111111111111111", balance="10.00")
    target_card = _card(db, user_id=target.user_id, number="4222222222222222", balance="100.00")
    return requester, requester_card, target, target_card


def _client(db: Session, *, user_id: int) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_verified_user] = lambda: user_id
    return TestClient(app)


def _pending_id(db: Session) -> int:
    return db.execute(select(RequestStatus.request_status_id).where(RequestStatus.name == "pending")).scalar_one()


def _approved_id(db: Session) -> int:
    return db.execute(select(RequestStatus.request_status_id).where(RequestStatus.name == "approved")).scalar_one()


def _declined_id(db: Session) -> int:
    return db.execute(select(RequestStatus.request_status_id).where(RequestStatus.name == "declined")).scalar_one()


def test_create_persists_pending_request_with_amount() -> None:
    db = _session()
    requester, _, target, _ = _pair(db)
    client = _client(db, user_id=requester.user_id)

    response = client.post(
        "/requests/money",
        json={"target_user_id": target.user_id, "amount": _AMOUNT, "note": "lunch"},
    )
    assert response.status_code == 201, response.text
    data = response.json()["data"]
    assert data["target_user_id"] == target.user_id
    assert data["requester_user_id"] == requester.user_id
    assert data["note"] == "lunch"
    assert data["money_request_detail"]["amount"] == _AMOUNT
    assert data["money_request_detail"]["settled_transaction_id"] is None

    detail = db.get(MoneyRequestDetail, data["request_id"])
    assert detail is not None
    assert detail.amount == Decimal(_AMOUNT)
    request = db.get(Request, data["request_id"])
    assert request.request_status_id == _pending_id(db)
    assert request.target_user_id == target.user_id


def test_self_request_is_rejected() -> None:
    db = _session()
    requester, _, _, _ = _pair(db)
    client = _client(db, user_id=requester.user_id)

    response = client.post(
        "/requests/money",
        json={"target_user_id": requester.user_id, "amount": _AMOUNT},
    )
    assert response.status_code == 400
    assert db.scalar(select(Request)) is None


def test_duplicate_pending_request_is_rejected() -> None:
    db = _session()
    requester, _, target, _ = _pair(db)
    client = _client(db, user_id=requester.user_id)
    body = {"target_user_id": target.user_id, "amount": _AMOUNT}

    first = client.post("/requests/money", json=body)
    assert first.status_code == 201
    second = client.post("/requests/money", json=body)
    assert second.status_code == 409
    assert len(db.scalars(select(Request)).all()) == 1


def test_target_sees_incoming_requester_does_not() -> None:
    db = _session()
    requester, _, target, _ = _pair(db)
    as_requester = _client(db, user_id=requester.user_id)
    created = as_requester.post(
        "/requests/money",
        json={"target_user_id": target.user_id, "amount": _AMOUNT},
    )
    assert created.status_code == 201
    request_id = created.json()["data"]["request_id"]

    incoming_for_target = _client(db, user_id=target.user_id).get("/requests/money/incoming")
    assert incoming_for_target.status_code == 200
    items = incoming_for_target.json()["data"]["items"]
    assert incoming_for_target.json()["data"]["total"] == 1
    assert items[0]["request_id"] == request_id
    assert items[0]["money_request_detail"]["amount"] == _AMOUNT
    assert items[0]["money_request_detail"]["requester_name"] == "Ada Lovelace"

    incoming_for_requester = as_requester.get("/requests/money/incoming")
    assert incoming_for_requester.json()["data"]["total"] == 0


def test_decline_resolves_request_and_moves_no_money() -> None:
    db = _session()
    requester, requester_card, target, target_card = _pair(db)
    as_requester = _client(db, user_id=requester.user_id)
    created = as_requester.post(
        "/requests/money",
        json={"target_user_id": target.user_id, "amount": _AMOUNT},
    )
    request_id = created.json()["data"]["request_id"]

    declined = _client(db, user_id=target.user_id).post(f"/requests/money/{request_id}/decline")
    assert declined.status_code == 200, declined.text
    request = db.get(Request, request_id)
    assert request.request_status_id == _declined_id(db)
    db.refresh(requester_card)
    db.refresh(target_card)
    assert requester_card.balance == Decimal("10.00")
    assert target_card.balance == Decimal("100.00")
    assert db.scalar(select(Transaction)) is None

    incoming = _client(db, user_id=target.user_id).get("/requests/money/incoming")
    assert incoming.json()["data"]["total"] == 0


def test_non_target_cannot_pay_or_decline() -> None:
    db = _session()
    requester, _, target, target_card = _pair(db)
    created = _client(db, user_id=requester.user_id).post(
        "/requests/money",
        json={"target_user_id": target.user_id, "amount": _AMOUNT},
    )
    request_id = created.json()["data"]["request_id"]

    pay = _client(db, user_id=requester.user_id).post(
        f"/requests/money/{request_id}/pay",
        json={"sender_card_id": target_card.card_id},
    )
    assert pay.status_code == 403
    decline = _client(db, user_id=requester.user_id).post(f"/requests/money/{request_id}/decline")
    assert decline.status_code == 403
    assert db.get(Request, request_id).request_status_id == _pending_id(db)


def test_pay_holds_target_balance_and_approves_request() -> None:
    db = _session()
    requester, requester_card, target, target_card = _pair(db)
    created = _client(db, user_id=requester.user_id).post(
        "/requests/money",
        json={"target_user_id": target.user_id, "amount": _AMOUNT, "note": "lunch"},
    )
    request_id = created.json()["data"]["request_id"]

    paid = _client(db, user_id=target.user_id).post(
        f"/requests/money/{request_id}/pay",
        json={"sender_card_id": target_card.card_id},
    )
    assert paid.status_code == 200, paid.text
    body = paid.json()["data"]
    assert body["request_status_id"] == _approved_id(db)
    settled_id = body["money_request_detail"]["settled_transaction_id"]
    assert settled_id is not None

    tx = db.get(Transaction, settled_id)
    assert tx is not None
    assert tx.sender_card_id == target_card.card_id
    assert tx.recipient_card_id == requester_card.card_id
    assert tx.amount == Decimal(_AMOUNT)
    assert tx.idempotency_key == f"moneyreq:{request_id}"

    db.refresh(target_card)
    db.refresh(requester_card)
    # Apply-on-settle: sender is held now; recipient is credited on complete.
    assert target_card.balance == Decimal("87.50")
    assert requester_card.balance == Decimal("10.00")

    incoming = _client(db, user_id=target.user_id).get("/requests/money/incoming")
    assert incoming.json()["data"]["total"] == 0


def test_double_pay_is_blocked() -> None:
    db = _session()
    requester, _, target, target_card = _pair(db)
    created = _client(db, user_id=requester.user_id).post(
        "/requests/money",
        json={"target_user_id": target.user_id, "amount": _AMOUNT},
    )
    request_id = created.json()["data"]["request_id"]
    as_target = _client(db, user_id=target.user_id)
    first = as_target.post(
        f"/requests/money/{request_id}/pay",
        json={"sender_card_id": target_card.card_id},
    )
    assert first.status_code == 200, first.text
    second = as_target.post(
        f"/requests/money/{request_id}/pay",
        json={"sender_card_id": target_card.card_id},
    )
    assert second.status_code == 409
    assert len(db.scalars(select(Transaction)).all()) == 1


def test_insufficient_funds_leaves_request_pending() -> None:
    db = _session()
    requester, _, target, _ = _pair(db)
    broke = _card(
        db, user_id=target.user_id, number="4333333333333333", balance="1.00", is_main=False
    )
    created = _client(db, user_id=requester.user_id).post(
        "/requests/money",
        json={"target_user_id": target.user_id, "amount": _AMOUNT},
    )
    request_id = created.json()["data"]["request_id"]

    paid = _client(db, user_id=target.user_id).post(
        f"/requests/money/{request_id}/pay",
        json={"sender_card_id": broke.card_id},
    )
    assert paid.status_code == 400, paid.text
    assert db.get(Request, request_id).request_status_id == _pending_id(db)
    assert db.scalar(select(Transaction)) is None
    db.refresh(broke)
    assert broke.balance == Decimal("1.00")


def test_requester_without_active_card_returns_409() -> None:
    db = _session()
    requester, requester_card, target, target_card = _pair(db)
    created = _client(db, user_id=requester.user_id).post(
        "/requests/money",
        json={"target_user_id": target.user_id, "amount": _AMOUNT},
    )
    request_id = created.json()["data"]["request_id"]
    requester_card.deleted_at = datetime.now(timezone.utc)
    db.commit()

    paid = _client(db, user_id=target.user_id).post(
        f"/requests/money/{request_id}/pay",
        json={"sender_card_id": target_card.card_id},
    )
    assert paid.status_code == 409, paid.text
    assert "no active card" in paid.json()["message"].lower()
    assert db.get(Request, request_id).request_status_id == _pending_id(db)
    assert db.scalar(select(Transaction)) is None
