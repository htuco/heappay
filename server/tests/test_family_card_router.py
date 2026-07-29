"""Router tests for shared-card membership: require_owns_card 403/404, and
add/list/remove member routes. Real in-memory SQLite (require_owns_card and
the membership service run a real query against the injected session), auth
overridden via get_current_user_id -- lighter than a real JWT round-trip,
matching test_card_main.py's dependency-override style, but with a real DB
since this route's authorization can't be faked as a service-layer swap.
"""
from __future__ import annotations

import os
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

import models  # noqa: E402,F401
from database import Base, get_db  # noqa: E402
from main import create_app  # noqa: E402
from models.card import Card  # noqa: E402
from models.card_status import CardStatus  # noqa: E402
from models.card_type import CardType  # noqa: E402
from models.email_verification_token import EmailVerificationToken  # noqa: E402,F401
from models.family_link import FamilyLink  # noqa: E402
from models.user import User  # noqa: E402
from models.user_role import UserRole  # noqa: E402
from models.user_status import UserStatus  # noqa: E402
from routes.dependencies import get_current_user_id  # noqa: E402


def _session() -> Session:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    db.add(UserStatus(status_name="active"))
    db.add(UserRole(role_name="user"))
    db.add(CardStatus(status_name="active"))
    db.add(CardType(type_name="debit", vendor="visa"))
    db.commit()
    return db


def _user(db: Session, *, email: str) -> User:
    user = User(
        email=email, first_name="First", last_name="Last", password_hash="hashed",
        status_id=1, user_role_id=1,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _card(db: Session, *, user_id: int, card_numb: str) -> Card:
    card = Card(
        user_id=user_id, status_id=1, card_type_id=1, card_numb=card_numb,
        last_four=card_numb[-4:], cvc="123", expires_at=date(2030, 12, 31),
        balance=Decimal("0.00"),
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


def _accept_link(db: Session, *, guardian_id: int, dependent_id: int) -> None:
    link = FamilyLink(
        guardian_user_id=guardian_id, dependent_user_id=dependent_id, status="accepted",
        responded_at=datetime.now(timezone.utc),
    )
    db.add(link)
    db.commit()


def _client(db: Session, *, user_id: int) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user_id] = lambda: user_id
    return TestClient(app)


def test_require_owns_card_404_for_missing_card() -> None:
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    client = _client(db, user_id=guardian.user_id)
    response = client.get("/family/cards/999/members")
    assert response.status_code == 404


def test_require_owns_card_403_for_non_owner() -> None:
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    other = _user(db, email="other@example.com")
    card = _card(db, user_id=guardian.user_id, card_numb="4111111111111111")
    client = _client(db, user_id=other.user_id)
    response = client.get(f"/family/cards/{card.card_id}/members")
    assert response.status_code == 403


def test_add_member_requires_accepted_family_link() -> None:
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    stranger = _user(db, email="stranger@example.com")
    card = _card(db, user_id=guardian.user_id, card_numb="4111111111111112")
    client = _client(db, user_id=guardian.user_id)

    response = client.post(
        f"/family/cards/{card.card_id}/members", json={"dependent_user_id": stranger.user_id}
    )
    assert response.status_code == 403


def test_add_list_and_remove_member() -> None:
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    dependent = _user(db, email="dependent@example.com")
    card = _card(db, user_id=guardian.user_id, card_numb="4111111111111113")
    _accept_link(db, guardian_id=guardian.user_id, dependent_id=dependent.user_id)
    client = _client(db, user_id=guardian.user_id)

    add_response = client.post(
        f"/family/cards/{card.card_id}/members", json={"dependent_user_id": dependent.user_id}
    )
    assert add_response.status_code == 201
    assert add_response.json()["dependent_user_id"] == dependent.user_id

    list_response = client.get(f"/family/cards/{card.card_id}/members")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    remove_response = client.delete(f"/family/cards/{card.card_id}/members/{dependent.user_id}")
    assert remove_response.status_code == 204

    list_response_2 = client.get(f"/family/cards/{card.card_id}/members")
    assert list_response_2.json() == []


def test_add_duplicate_member_is_conflict() -> None:
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    dependent = _user(db, email="dependent@example.com")
    card = _card(db, user_id=guardian.user_id, card_numb="4111111111111114")
    _accept_link(db, guardian_id=guardian.user_id, dependent_id=dependent.user_id)
    client = _client(db, user_id=guardian.user_id)

    client.post(f"/family/cards/{card.card_id}/members", json={"dependent_user_id": dependent.user_id})
    response = client.post(
        f"/family/cards/{card.card_id}/members", json={"dependent_user_id": dependent.user_id}
    )
    assert response.status_code == 409


def test_card_overall_spending_limit_crud() -> None:
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    card = _card(db, user_id=guardian.user_id, card_numb="4111111111111115")
    client = _client(db, user_id=guardian.user_id)

    create_response = client.post(
        f"/family/cards/{card.card_id}/spending-limits",
        json={"period": "monthly", "max_amount": "200.00"},
    )
    assert create_response.status_code == 201
    rule = create_response.json()["data"]
    assert rule["card_id"] == card.card_id
    assert rule["dependent_user_id"] is None

    list_response = client.get(f"/family/cards/{card.card_id}/spending-limits")
    assert len(list_response.json()["data"]) == 1

    delete_response = client.delete(
        f"/family/cards/{card.card_id}/spending-limits/{rule['spending_limit_rule_id']}"
    )
    assert delete_response.status_code == 204
