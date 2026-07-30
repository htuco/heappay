"""Tests for transaction email notifications."""
import os
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models  # noqa: F401  # register the full ORM graph before mapper configure
from models.email_verification_token import EmailVerificationToken  # noqa: F401
from database import Base, SQLITE_SCHEMA_TRANSLATE_MAP
from models.card import Card
from models.email_notification_log import EmailNotificationLog
from models.user import User
from models.user_role import UserRole
from models.user_status import UserStatus
from repositories.email.email_notification_log import EmailNotificationLogRepository
from services.email.mailer import EmailMailer
from services.email.transaction_notifier import (
    EVENT_TOPUP,
    TransactionEmailNotifier,
)


def _session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        # Tables are namespaced (identity.users, money.cards, ...) but SQLite has
        # no schema support, so every namespace is translated away here. This
        # applies to DDL too, so create_all() below works unchanged.
    ).execution_options(schema_translate_map=SQLITE_SCHEMA_TRANSLATE_MAP)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def _user(**kwargs) -> User:
    defaults = dict(
        email="user@example.com",
        first_name="Test",
        last_name="User",
        password_hash="x",
        status_id=1,
        user_role_id=1,
        email_payment_sent_enabled=True,
        email_payment_received_enabled=True,
        email_topup_enabled=True,
        email_refund_status_enabled=True,
        email_outflow_enabled=True,
    )
    defaults.update(kwargs)
    return User(**defaults)


def test_mailer_logs_when_smtp_not_configured() -> None:
    settings = MagicMock()
    settings.smtp_host = None
    settings.mail_from = "noreply@heap.test"
    mailer = EmailMailer(settings)
    assert mailer.send(to="a@b.com", subject="Hi", body="Body") is True


def test_dedup_log_prevents_second_send() -> None:
    db = _session()
    db.add(UserStatus(status_name="active"))
    db.add(UserRole(role_name="user"))
    db.add(_user())
    db.commit()

    repo = EmailNotificationLogRepository(db)
    assert repo.try_record_send(user_id=1, event_type=EVENT_TOPUP, reference_id="42") is True
    assert repo.try_record_send(user_id=1, event_type=EVENT_TOPUP, reference_id="42") is False
    assert db.query(EmailNotificationLog).count() == 1


def test_notify_topup_skips_when_preference_disabled() -> None:
    db = _session()
    notifier = TransactionEmailNotifier(db)
    user = _user(email_topup_enabled=False)
    tx = MagicMock()
    tx.transaction_id = 1
    tx.amount = "10.00"
    tx.recipient_card = MagicMock(user=user)

    mailer = MagicMock()
    with patch.object(notifier, "_mailer", mailer):
        notifier._notify_topup(tx)

    mailer.send.assert_not_called()


def test_notify_topup_sends_once() -> None:
    db = _session()
    db.add(UserStatus(status_name="active"))
    db.add(UserRole(role_name="user"))
    db.add(_user())
    db.commit()

    notifier = TransactionEmailNotifier(db)
    user = db.get(User, 1)
    tx = MagicMock()
    tx.transaction_id = 7
    tx.amount = "25.00"
    tx.recipient_card = MagicMock(user=user)

    mailer = MagicMock()
    with patch.object(notifier, "_mailer", mailer):
        notifier._notify_topup(tx)
        notifier._notify_topup(tx)

    assert mailer.send.call_count == 1
    assert mailer.send.call_args.kwargs["to"] == "user@example.com"
    assert "Top-up" in mailer.send.call_args.kwargs["subject"]


def test_payment_sent_respects_preference() -> None:
    db = _session()
    notifier = TransactionEmailNotifier(db)
    user = _user(email_payment_sent_enabled=False)
    tx = MagicMock()
    tx.transaction_id = 3
    tx.amount = "5.00"
    tx.sender_card = MagicMock(user=user)

    mailer = MagicMock()
    with patch.object(notifier, "_mailer", mailer):
        notifier._notify_payment_sent(tx)

    mailer.send.assert_not_called()


_card_seq = 0


def _card(**kwargs) -> Card:
    global _card_seq
    _card_seq += 1
    number = f"41111111111{_card_seq:05d}"
    defaults = dict(
        user_id=1,
        status_id=1,
        card_type_id=1,
        card_numb=number,
        last_four=number[-4:],
        cvc="123",
        expires_at=date(2030, 1, 1),
        balance=Decimal("0.00"),
    )
    defaults.update(kwargs)
    return Card(**defaults)


def test_outflow_respects_preference() -> None:
    db = _session()
    notifier = TransactionEmailNotifier(db)
    user = _user(email_outflow_enabled=False)
    tx = MagicMock()
    tx.transaction_id = 11
    tx.amount = "5.00"
    tx.sender_card = MagicMock(user=user)
    tx.recipient_card = None

    mailer = MagicMock()
    with patch.object(notifier, "_mailer", mailer):
        notifier._notify_outflow(tx)

    mailer.send.assert_not_called()


def test_outflow_skips_self_transfer() -> None:
    db = _session()
    notifier = TransactionEmailNotifier(db)
    user = _user()
    user.user_id = 1
    tx = MagicMock()
    tx.transaction_id = 12
    tx.amount = "5.00"
    tx.sender_card = MagicMock(user=user)
    tx.recipient_card = MagicMock(user=user)

    mailer = MagicMock()
    with patch.object(notifier, "_mailer", mailer):
        notifier._notify_outflow(tx)

    mailer.send.assert_not_called()


def test_outflow_sends_once_with_current_balance() -> None:
    db = _session()
    db.add(UserStatus(status_name="active"))
    db.add(UserRole(role_name="user"))
    db.add(_user(wallet_balance=Decimal("100.00")))
    db.commit()
    # Two active cards (net of the escrow debit) + a deleted card that must be
    # excluded from the balance total.
    db.add(_card(user_id=1, balance=Decimal("250.00")))
    db.add(_card(user_id=1, balance=Decimal("100.00")))
    db.add(_card(user_id=1, balance=Decimal("999.00"), deleted_at=date(2029, 1, 1)))
    db.commit()

    notifier = TransactionEmailNotifier(db)
    user = db.get(User, 1)
    tx = MagicMock()
    tx.transaction_id = 20
    tx.amount = "50.00"
    tx.sender_card = MagicMock(user=user)
    tx.recipient_card = None

    mailer = MagicMock()
    with patch.object(notifier, "_mailer", mailer):
        notifier._notify_outflow(tx)
        notifier._notify_outflow(tx)

    assert mailer.send.call_count == 1
    kwargs = mailer.send.call_args.kwargs
    assert kwargs["to"] == "user@example.com"
    assert "outflow" in kwargs["subject"].lower()
    # 100 wallet + 250 + 100 active cards = 450.00 (deleted card excluded).
    assert "$450.00" in kwargs["body"]


def test_current_balance_excludes_deleted_cards() -> None:
    db = _session()
    db.add(UserStatus(status_name="active"))
    db.add(UserRole(role_name="user"))
    db.add(_user(wallet_balance=Decimal("10.00")))
    db.commit()
    db.add(_card(user_id=1, balance=Decimal("40.00")))
    db.add(_card(user_id=1, balance=Decimal("500.00"), deleted_at=date(2029, 1, 1)))
    db.commit()

    notifier = TransactionEmailNotifier(db)
    assert notifier._current_balance_for_user(1) == Decimal("50.00")
