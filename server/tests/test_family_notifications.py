"""Family notification tests: the opt-out flag is respected and the dedup
ledger prevents the same event sending twice.

Uses a real in-memory SQLite session (mirroring test_admin_notifications.py)
because the dedup guard *is* a unique constraint -- a hand-written fake
couldn't verify it.
"""
from __future__ import annotations

import os
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

import models  # noqa: E402,F401  (register all ORM mappers)
from database import Base, SQLITE_SCHEMA_TRANSLATE_MAP  # noqa: E402
from models.email_verification_token import EmailVerificationToken  # noqa: E402,F401
from models.family_notification_log import FamilyNotificationLog  # noqa: E402
from models.user import User  # noqa: E402
from models.user_role import UserRole  # noqa: E402
from models.user_status import UserStatus  # noqa: E402
from repositories.family.family_notification import FamilyNotificationRepository  # noqa: E402
from services.family.family_notification import (  # noqa: E402
    EVENT_ALLOWANCE_RECEIVED,
    FamilyNotificationService,
)


@pytest.fixture(autouse=True)
def _no_real_smtp(monkeypatch):
    """SMTP is configured in this project's .env, so without this every test
    that triggers a notification would open a real connection and try to
    deliver mail. Stub the transport; these tests are about the opt-out gate
    and the dedup ledger, not delivery."""
    sent: list[dict] = []

    def _capture(self, *, to: str, subject: str, body: str) -> bool:
        sent.append({"to": to, "subject": subject, "body": body})
        return True

    monkeypatch.setattr("services.email.mailer.EmailMailer.send", _capture)
    return sent


def _session() -> Session:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        # Tables are namespaced but SQLite has no schema support, so translate
        # every namespace away. Applies to DDL, so create_all() works unchanged.
    ).execution_options(schema_translate_map=SQLITE_SCHEMA_TRANSLATE_MAP)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    db.add(UserStatus(status_name="active"))
    db.add(UserRole(role_name="user"))
    db.commit()
    return db


def _user(db: Session, *, email: str, family_emails: bool = True) -> User:
    user = User(
        email=email,
        first_name="First",
        last_name="Last",
        password_hash="hashed",
        status_id=1,
        user_role_id=1,
        email_family_activity_enabled=family_emails,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _log_count(db: Session, recipient_user_id: int) -> int:
    rows = db.execute(
        select(FamilyNotificationLog).where(
            FamilyNotificationLog.recipient_user_id == recipient_user_id
        )
    ).all()
    return len(rows)


def test_dedup_ledger_records_first_send_only() -> None:
    db = _session()
    recipient = _user(db, email="recipient@example.com")
    repo = FamilyNotificationRepository(db)

    first = repo.try_record_send(
        recipient_user_id=recipient.user_id,
        recipient_email=recipient.email,
        event_type=EVENT_ALLOWANCE_RECEIVED,
        reference_id="ref-1",
    )
    second = repo.try_record_send(
        recipient_user_id=recipient.user_id,
        recipient_email=recipient.email,
        event_type=EVENT_ALLOWANCE_RECEIVED,
        reference_id="ref-1",
    )
    assert first is True
    assert second is False
    assert _log_count(db, recipient.user_id) == 1


def test_distinct_reference_ids_both_record() -> None:
    db = _session()
    recipient = _user(db, email="recipient@example.com")
    repo = FamilyNotificationRepository(db)

    for ref in ("ref-1", "ref-2"):
        assert (
            repo.try_record_send(
                recipient_user_id=recipient.user_id,
                recipient_email=recipient.email,
                event_type=EVENT_ALLOWANCE_RECEIVED,
                reference_id=ref,
            )
            is True
        )
    assert _log_count(db, recipient.user_id) == 2


def test_opt_out_suppresses_send_entirely(_no_real_smtp) -> None:
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    dependent = _user(db, email="dependent@example.com", family_emails=False)

    FamilyNotificationService(db).notify_allowance_received(
        dependent_user_id=dependent.user_id,
        guardian_user_id=guardian.user_id,
        amount=Decimal("25.00"),
        reference_id="ref-1",
    )
    # Opted out: nothing sent, and nothing written to the ledger either.
    assert _log_count(db, dependent.user_id) == 0
    assert _no_real_smtp == []


def test_opted_in_recipient_is_recorded(_no_real_smtp) -> None:
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    dependent = _user(db, email="dependent@example.com", family_emails=True)

    FamilyNotificationService(db).notify_allowance_received(
        dependent_user_id=dependent.user_id,
        guardian_user_id=guardian.user_id,
        amount=Decimal("25.00"),
        reference_id="ref-1",
    )
    assert _log_count(db, dependent.user_id) == 1
    assert len(_no_real_smtp) == 1
    assert _no_real_smtp[0]["to"] == "dependent@example.com"


def test_notification_failure_never_propagates() -> None:
    # Fail-open posture: a missing recipient must not raise into the caller
    # that triggered the notification.
    db = _session()
    guardian = _user(db, email="guardian@example.com")
    FamilyNotificationService(db).notify_allowance_received(
        dependent_user_id=99999,
        guardian_user_id=guardian.user_id,
        amount=Decimal("25.00"),
        reference_id="ref-1",
    )
