"""Tests for admin email notifications on user-submitted requests."""
from __future__ import annotations

from collections.abc import Generator
from decimal import Decimal
import os
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

import models  # noqa: E402,F401  (register all ORM mappers)
from database import Base, SQLITE_SCHEMA_TRANSLATE_MAP  # noqa: E402
from models.email_verification_token import EmailVerificationToken  # noqa: E402,F401
from models.admin_notification_log import AdminNotificationLog  # noqa: E402
from models.user import User  # noqa: E402
from models.user_role import UserRole  # noqa: E402
from models.user_status import UserStatus  # noqa: E402
from repositories.admin_notification.admin_notification import (  # noqa: E402
    AdminNotificationRepository,
)
from services.admin_notification.admin_notification import (  # noqa: E402
    EVENT_REFUND_REQUESTED,
    EVENT_TRANSACTION_FLAGGED,
    AdminNotificationService,
)

_ROLE_IDS = {"user": 1, "admin": 2, "support": 3}


def _session() -> Session:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        # Tables are namespaced (identity.users, money.cards, ...) but SQLite has
        # no schema support, so every namespace is translated away here. This
        # applies to DDL too, so create_all() below works unchanged.
    ).execution_options(schema_translate_map=SQLITE_SCHEMA_TRANSLATE_MAP)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    db.add(UserStatus(status_name="active"))
    db.add(UserRole(role_name="user"))
    db.add(UserRole(role_name="admin"))
    db.add(UserRole(role_name="support"))
    db.commit()
    return db


def _user(
    db: Session,
    *,
    email: str,
    role: str = "admin",
    notify: bool = True,
) -> User:
    user = User(
        email=email,
        first_name="Staff",
        last_name="Member",
        password_hash="hashed",
        status_id=1,
        user_role_id=_ROLE_IDS[role],
        notify_on_user_requests=notify,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _fake_refund_request(request_id: int = 1) -> SimpleNamespace:
    return SimpleNamespace(
        request_id=request_id,
        requester_user_id=42,
        note="Please refund",
        requester=SimpleNamespace(first_name="Reg", last_name="User"),
        refund_detail=SimpleNamespace(
            transaction_id=100,
            transaction=SimpleNamespace(amount=Decimal("50.00")),
        ),
    )


@pytest.fixture
def db() -> Generator[Session, None, None]:
    session = _session()
    try:
        yield session
    finally:
        session.close()


def test_list_opted_in_recipients_only_staff_with_optin(db: Session) -> None:
    _user(db, email="admin-on@heap.test", role="admin", notify=True)
    _user(db, email="support-on@heap.test", role="support", notify=True)
    _user(db, email="admin-off@heap.test", role="admin", notify=False)
    _user(db, email="user-on@heap.test", role="user", notify=True)

    recipients = AdminNotificationRepository(db).list_opted_in_recipients()
    emails = {r.email for r in recipients}
    assert emails == {"admin-on@heap.test", "support-on@heap.test"}


def test_refund_request_emails_opted_in_staff_and_logs(db: Session) -> None:
    _user(db, email="admin-on@heap.test", role="admin", notify=True)
    service = AdminNotificationService(db)
    sent: list[tuple[str, str]] = []
    service._load_refund_request = lambda _id: _fake_refund_request()  # type: ignore[assignment]
    service._mailer.send = lambda *, to, subject, body: sent.append((to, subject)) or True  # type: ignore[assignment]

    service.notify_refund_requested(1)

    assert len(sent) == 1
    assert sent[0][0] == "admin-on@heap.test"
    logs = db.scalars(
        select(AdminNotificationLog).where(
            AdminNotificationLog.event_type == EVENT_REFUND_REQUESTED
        )
    ).all()
    assert len(logs) == 1
    assert logs[0].recipient_email == "admin-on@heap.test"
    assert logs[0].reference_id == "1"


def test_refund_request_is_deduped(db: Session) -> None:
    _user(db, email="admin-on@heap.test", role="admin", notify=True)
    service = AdminNotificationService(db)
    sent: list[str] = []
    service._load_refund_request = lambda _id: _fake_refund_request()  # type: ignore[assignment]
    service._mailer.send = lambda *, to, subject, body: sent.append(to) or True  # type: ignore[assignment]

    service.notify_refund_requested(1)
    service.notify_refund_requested(1)

    assert len(sent) == 1
    logs = db.scalars(select(AdminNotificationLog)).all()
    assert len(logs) == 1


def test_no_email_to_opted_out_or_non_staff(db: Session) -> None:
    _user(db, email="admin-off@heap.test", role="admin", notify=False)
    _user(db, email="user-on@heap.test", role="user", notify=True)
    service = AdminNotificationService(db)
    sent: list[str] = []
    service._load_refund_request = lambda _id: _fake_refund_request()  # type: ignore[assignment]
    service._mailer.send = lambda *, to, subject, body: sent.append(to) or True  # type: ignore[assignment]

    service.notify_refund_requested(1)

    assert sent == []
    assert db.scalars(select(AdminNotificationLog)).all() == []


def test_fail_open_when_mailer_raises(db: Session) -> None:
    _user(db, email="admin-on@heap.test", role="admin", notify=True)
    service = AdminNotificationService(db)
    service._load_refund_request = lambda _id: _fake_refund_request()  # type: ignore[assignment]

    def boom(**_kwargs):
        raise RuntimeError("smtp down")

    service._mailer.send = boom  # type: ignore[assignment]

    # Must not raise — a mail failure cannot block the user's request.
    service.notify_refund_requested(1)

    # The audit/dedup row was still recorded (matches existing notifier behaviour).
    assert len(db.scalars(select(AdminNotificationLog)).all()) == 1


def test_transaction_flagged_emails_and_dedupes(db: Session) -> None:
    _user(db, email="admin-on@heap.test", role="admin", notify=True)
    service = AdminNotificationService(db)
    sent: list[str] = []
    service._db.get = lambda _model, _pk: SimpleNamespace(amount=Decimal("999999.00"))  # type: ignore[assignment]
    service._mailer.send = lambda *, to, subject, body: sent.append(subject) or True  # type: ignore[assignment]

    service.notify_transaction_flagged(500, reason="over threshold")
    service.notify_transaction_flagged(500, reason="over threshold")

    assert len(sent) == 1
    logs = db.scalars(
        select(AdminNotificationLog).where(
            AdminNotificationLog.event_type == EVENT_TRANSACTION_FLAGGED
        )
    ).all()
    assert len(logs) == 1
    assert logs[0].reference_id == "500"
