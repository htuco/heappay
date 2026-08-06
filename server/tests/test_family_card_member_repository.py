"""Real-SQLite tests for FamilyCardMemberRepository: unique constraint on
(card_id, dependent_user_id), cascade-delete when the card is removed, and
is_member/list_cards_for_member correctness. Mirrors test_admin_notifications.py's
in-memory-SQLite style, used here because these behaviors depend on real
constraint enforcement, not something a hand-written fake can verify.
"""
from __future__ import annotations

import os
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

import models  # noqa: E402,F401  (register all ORM mappers)
from database import Base, SQLITE_SCHEMA_TRANSLATE_MAP  # noqa: E402
from models.card import Card  # noqa: E402
from models.card_status import CardStatus  # noqa: E402
from models.card_type import CardType  # noqa: E402
from models.email_verification_token import EmailVerificationToken  # noqa: E402,F401
from models.family_card_member import FamilyCardMember  # noqa: E402
from models.user import User  # noqa: E402
from models.user_role import UserRole  # noqa: E402
from models.user_status import UserStatus  # noqa: E402
from repositories.family.family_card_member import FamilyCardMemberRepository  # noqa: E402


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
    db.commit()
    return db


def _user(db: Session, *, email: str) -> User:
    user = User(
        email=email,
        first_name="First",
        last_name="Last",
        password_hash="hashed",
        status_id=1,
        user_role_id=1,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _card(db: Session, *, user_id: int, card_numb: str) -> Card:
    card = Card(
        user_id=user_id,
        status_id=1,
        card_type_id=1,
        card_numb=card_numb,
        last_four=card_numb[-4:],
        cvc="123",
        expires_at=date(2030, 12, 31),
        balance=Decimal("0.00"),
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


def test_add_and_is_member() -> None:
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    dependent = _user(db, email="dependent@example.com")
    card = _card(db, user_id=guardian.user_id, card_numb="4111111111111111")

    repo = FamilyCardMemberRepository(db)
    assert repo.is_member(card_id=card.card_id, dependent_user_id=dependent.user_id) is False

    repo.add(card_id=card.card_id, dependent_user_id=dependent.user_id, added_by_user_id=guardian.user_id)
    assert repo.is_member(card_id=card.card_id, dependent_user_id=dependent.user_id) is True


def test_unique_constraint_rejects_duplicate_membership() -> None:
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    dependent = _user(db, email="dependent@example.com")
    card = _card(db, user_id=guardian.user_id, card_numb="4111111111111112")

    repo = FamilyCardMemberRepository(db)
    repo.add(card_id=card.card_id, dependent_user_id=dependent.user_id, added_by_user_id=guardian.user_id)
    with pytest.raises(IntegrityError):
        repo.add(
            card_id=card.card_id, dependent_user_id=dependent.user_id, added_by_user_id=guardian.user_id
        )


def test_list_cards_for_member() -> None:
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    dependent = _user(db, email="dependent@example.com")
    card_a = _card(db, user_id=guardian.user_id, card_numb="4111111111111113")
    card_b = _card(db, user_id=guardian.user_id, card_numb="4111111111111114")

    repo = FamilyCardMemberRepository(db)
    repo.add(card_id=card_a.card_id, dependent_user_id=dependent.user_id, added_by_user_id=guardian.user_id)

    assert repo.list_cards_for_member(dependent.user_id) == [card_a.card_id]
    assert card_b.card_id not in repo.list_cards_for_member(dependent.user_id)


def test_remove_membership() -> None:
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    dependent = _user(db, email="dependent@example.com")
    card = _card(db, user_id=guardian.user_id, card_numb="4111111111111115")

    repo = FamilyCardMemberRepository(db)
    repo.add(card_id=card.card_id, dependent_user_id=dependent.user_id, added_by_user_id=guardian.user_id)
    row = repo.get(card_id=card.card_id, dependent_user_id=dependent.user_id)
    assert row is not None
    repo.remove(row)
    assert repo.is_member(card_id=card.card_id, dependent_user_id=dependent.user_id) is False


def test_list_for_card_includes_user_details() -> None:
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    dependent = _user(db, email="dependent@example.com")
    card = _card(db, user_id=guardian.user_id, card_numb="4111111111111116")

    repo = FamilyCardMemberRepository(db)
    repo.add(card_id=card.card_id, dependent_user_id=dependent.user_id, added_by_user_id=guardian.user_id)

    rows = repo.list_for_card(card.card_id)
    assert len(rows) == 1
    member, user = rows[0]
    assert member.dependent_user_id == dependent.user_id
    assert user.email == "dependent@example.com"
