"""Tests for the admin user manage modal's backing data and actions.

Three separate concerns, all reachable from the same modal:

* ``UserRepository.total_spent_by_user`` -- the per-user spend aggregate. Run
  against real (in-memory SQLite) rows rather than a fake, because the whole
  point of it is the SQL: the joins, the own-account exclusion and the
  initiated_by_user_id fallback are not things a hand-written double can
  verify. Mirrors test_family_card_member_repository.py's style.
* ``last_login_at`` -- stamped when a session begins, and pointedly *not* on
  refresh.
* the admin-triggered password reset -- reuses the self-service flow, fails
  loudly on an unknown user, and never sets a password directly.
"""
from __future__ import annotations

import os
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
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
from models.transaction import Transaction  # noqa: E402
from models.transaction_status import TransactionStatus  # noqa: E402
from models.transaction_type import TransactionType  # noqa: E402
from models.user import User  # noqa: E402
from models.user_role import UserRole  # noqa: E402
from models.user_status import UserStatus  # noqa: E402
from repositories.user.user import UserRepository  # noqa: E402

_COMPLETED = 1
_PENDING = 2
_FAILED = 3
_PAYMENT = 1


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
    # Ids are asserted against the module constants above, so the insert order
    # matters: "completed" must be resolvable by name, which is the whole point
    # of the repository looking it up rather than hardcoding an id.
    db.add(TransactionStatus(name="completed"))
    db.add(TransactionStatus(name="pending"))
    db.add(TransactionStatus(name="failed"))
    db.add(TransactionType(name="payment"))
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


def _card(db: Session, *, user_id: int, last_four: str) -> Card:
    card = Card(
        user_id=user_id,
        status_id=1,
        card_type_id=1,
        card_numb=f"400000000000{last_four}",
        last_four=last_four,
        cvc="123",
        expires_at=date(2030, 12, 31),
        cardholder_name="First Last",
        balance=Decimal("1000.00"),
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


def _tx(
    db: Session,
    *,
    sender_card_id: int | None,
    recipient_card_id: int,
    amount: str,
    status_id: int = _COMPLETED,
    initiated_by_user_id: int | None = None,
) -> Transaction:
    row = Transaction(
        sender_card_id=sender_card_id,
        recipient_card_id=recipient_card_id,
        transaction_type_id=_PAYMENT,
        status_id=status_id,
        amount=Decimal(amount),
        initiated_by_user_id=initiated_by_user_id,
        processing_eligible_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.commit()
    return row


# ─── total_spent_by_user ──────────────────────────────────────────────────────

def test_sums_completed_outgoing_for_the_sender_card_owner():
    db = _session()
    payer = _user(db, email="payer@example.com")
    payee = _user(db, email="payee@example.com")
    payer_card = _card(db, user_id=payer.user_id, last_four="1111")
    payee_card = _card(db, user_id=payee.user_id, last_four="2222")

    _tx(db, sender_card_id=payer_card.card_id, recipient_card_id=payee_card.card_id, amount="40.00")
    _tx(db, sender_card_id=payer_card.card_id, recipient_card_id=payee_card.card_id, amount="2.50")

    spend = UserRepository(db).total_spent_by_user([payer.user_id, payee.user_id])
    assert spend[payer.user_id] == Decimal("42.50")
    # The payee received money; receiving is not spending.
    assert payee.user_id not in spend


def test_ignores_transactions_that_are_not_completed():
    db = _session()
    payer = _user(db, email="payer@example.com")
    payee = _user(db, email="payee@example.com")
    payer_card = _card(db, user_id=payer.user_id, last_four="1111")
    payee_card = _card(db, user_id=payee.user_id, last_four="2222")

    _tx(db, sender_card_id=payer_card.card_id, recipient_card_id=payee_card.card_id, amount="10.00")
    _tx(
        db,
        sender_card_id=payer_card.card_id,
        recipient_card_id=payee_card.card_id,
        amount="500.00",
        status_id=_PENDING,
    )
    _tx(
        db,
        sender_card_id=payer_card.card_id,
        recipient_card_id=payee_card.card_id,
        amount="900.00",
        status_id=_FAILED,
    )

    spend = UserRepository(db).total_spent_by_user([payer.user_id])
    assert spend[payer.user_id] == Decimal("10.00")


def test_ignores_deposits_which_have_no_sender_card():
    """A top-up is initiated by the user but is money coming *in*."""
    db = _session()
    user = _user(db, email="saver@example.com")
    card = _card(db, user_id=user.user_id, last_four="1111")

    _tx(
        db,
        sender_card_id=None,
        recipient_card_id=card.card_id,
        amount="750.00",
        initiated_by_user_id=user.user_id,
    )

    assert UserRepository(db).total_spent_by_user([user.user_id]) == {}


def test_ignores_moves_between_the_users_own_cards():
    db = _session()
    user = _user(db, email="owner@example.com")
    first = _card(db, user_id=user.user_id, last_four="1111")
    second = _card(db, user_id=user.user_id, last_four="2222")
    other = _user(db, email="other@example.com")
    other_card = _card(db, user_id=other.user_id, last_four="3333")

    _tx(db, sender_card_id=first.card_id, recipient_card_id=second.card_id, amount="300.00")
    _tx(db, sender_card_id=first.card_id, recipient_card_id=other_card.card_id, amount="25.00")

    spend = UserRepository(db).total_spent_by_user([user.user_id])
    assert spend[user.user_id] == Decimal("25.00")


def test_attributes_shared_card_spend_to_the_initiator_not_the_owner():
    """A dependent spending from a guardian's card is the dependent's spend.

    This is the case card ownership alone gets wrong, and the only reason
    initiated_by_user_id is consulted at all.
    """
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    dependent = _user(db, email="dependent@example.com")
    merchant = _user(db, email="merchant@example.com")
    shared = _card(db, user_id=guardian.user_id, last_four="1111")
    merchant_card = _card(db, user_id=merchant.user_id, last_four="2222")

    _tx(
        db,
        sender_card_id=shared.card_id,
        recipient_card_id=merchant_card.card_id,
        amount="60.00",
        initiated_by_user_id=dependent.user_id,
    )

    spend = UserRepository(db).total_spent_by_user([guardian.user_id, dependent.user_id])
    assert spend[dependent.user_id] == Decimal("60.00")
    assert guardian.user_id not in spend


def test_returns_empty_for_no_user_ids_without_querying():
    db = _session()
    assert UserRepository(db).total_spent_by_user([]) == {}


# ─── last_login_at ────────────────────────────────────────────────────────────

def test_touch_last_login_stamps_the_column():
    db = _session()
    user = _user(db, email="signin@example.com")
    assert user.last_login_at is None

    from repositories.user.auth import UserAuthRepository

    before = datetime.now(timezone.utc)
    UserAuthRepository(db).touch_last_login(user.user_id)
    db.refresh(user)

    assert user.last_login_at is not None
    # SQLite hands back a naive datetime; compare on the wall clock only.
    assert user.last_login_at.replace(tzinfo=timezone.utc) >= before.replace(microsecond=0)


def test_refresh_path_does_not_stamp_last_login():
    """A token refresh fires on a timer in every open tab.

    If it stamped last_login_at the column would read ~now for anybody with a
    stale tab open, which is precisely the thing that makes it useless for
    support triage.
    """
    import inspect

    from services.user.auth import UserAuthService

    source = inspect.getsource(UserAuthService.refresh)
    assert "touch_last_login" not in source


def test_every_session_starting_path_stamps_last_login():
    import inspect

    from services.user.auth import UserAuthService

    for method in ("login", "verify_totp_login", "register", "accept_invitation"):
        source = inspect.getsource(getattr(UserAuthService, method))
        assert "touch_last_login" in source, f"{method} does not stamp last_login_at"


# ─── admin-triggered password reset ───────────────────────────────────────────

class _ResetRepo:
    """Minimal auth repo covering only what the reset path touches."""

    def __init__(self, user) -> None:
        self._user = user
        self.tokens: list[tuple[int, str]] = []

    def get_user_by_id(self, user_id: int):
        return self._user if self._user and user_id == self._user.user_id else None

    def create_password_reset_token(self, user_id: int, token_hash: str, expires_at) -> None:
        self.tokens.append((user_id, token_hash))


class _Mailer:
    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []

    def send_reset_link(self, email: str, url: str) -> None:
        self.sent.append((email, url))


class _FailingMailer:
    def send_reset_link(self, email: str, url: str) -> None:
        raise RuntimeError("smtp down")


def _auth_service(repo, mailer):
    from services.user.auth import UserAuthService

    service = UserAuthService(repo)  # type: ignore[arg-type]
    service.password_reset_mailer = mailer
    return service


def _reset_user():
    from types import SimpleNamespace

    return SimpleNamespace(
        user_id=7,
        email="target@example.com",
        recovery_email=None,
        recovery_email_verified_at=None,
        deleted_at=None,
        password_hash="untouched",
    )


def test_admin_reset_issues_a_token_and_emails_the_user():
    user = _reset_user()
    repo = _ResetRepo(user)
    mailer = _Mailer()

    delivery = _auth_service(repo, mailer).send_password_reset_for_user(user.user_id)

    assert delivery == "target@example.com"
    assert len(repo.tokens) == 1 and repo.tokens[0][0] == user.user_id
    assert len(mailer.sent) == 1
    # A reset *link* -- the admin never chooses or learns the password.
    assert user.password_hash == "untouched"


def test_admin_reset_fails_loudly_for_an_unknown_user():
    """Unlike the public form, there is no address here to enumerate.

    Reporting success having sent nothing would be worse than an error.
    """
    with pytest.raises(ValueError, match="USER_NOT_FOUND"):
        _auth_service(_ResetRepo(None), _Mailer()).send_password_reset_for_user(999)


def test_admin_reset_fails_loudly_for_a_deleted_user():
    user = _reset_user()
    user.deleted_at = datetime.now(timezone.utc)
    with pytest.raises(ValueError, match="USER_NOT_FOUND"):
        _auth_service(_ResetRepo(user), _Mailer()).send_password_reset_for_user(user.user_id)


def test_admin_reset_surfaces_mail_delivery_failure():
    user = _reset_user()
    with pytest.raises(ValueError, match="MAIL_DELIVERY_FAILED"):
        _auth_service(_ResetRepo(user), _FailingMailer()).send_password_reset_for_user(user.user_id)
