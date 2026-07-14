"""Tests for primary (login) email verification."""
from __future__ import annotations

from collections.abc import Generator
from datetime import datetime, timedelta, timezone
import hashlib
import os
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from database import Base  # noqa: E402
from main import create_app  # noqa: E402
from models.email_verification_token import EmailVerificationToken  # noqa: E402
from models.user import User  # noqa: E402
from models.user_role import UserRole  # noqa: E402
from models.user_security_audit_event import UserSecurityAuditEvent  # noqa: E402
from models.user_status import UserStatus  # noqa: E402
from repositories.user.auth import UserAuthRepository  # noqa: E402
from routes.transaction.transaction import get_transaction_service  # noqa: E402
from schemas.user.auth import (  # noqa: E402
    ProfileUpdateRequest,
    RegisterRequest,
    VerifyEmailRequest,
)
from schemas.user.crud import UserCreateRequest  # noqa: E402
from services.user.auth import UserAuthService  # noqa: E402
from services.user.user import UserService  # noqa: E402
from settings import get_settings  # noqa: E402
from tests.test_transaction_idempotency import FakeTransactionService  # noqa: E402

_TEST_PASSWORD = "HeapTest1!"
_KNOWN_TOKEN = "known-verification-token-for-tests"


def _session() -> Session:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    db.add(UserStatus(status_name="active"))
    db.add(UserStatus(status_name="invited"))
    db.add(UserRole(role_name="user"))
    db.add(UserRole(role_name="admin"))
    db.commit()
    return db


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _user(
    db: Session,
    *,
    email: str = "user@example.com",
    email_verified_at: datetime | None = None,
) -> User:
    user = User(
        email=email,
        first_name="Test",
        last_name="User",
        password_hash="hashed",
        status_id=1,
        user_role_id=1,
        email_verified_at=email_verified_at,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _service(db: Session) -> UserAuthService:
    return UserAuthService(UserAuthRepository(db))


def _access_token(user_id: int) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _register_request(email: str = "new@example.com") -> RegisterRequest:
    return RegisterRequest(
        email=email,
        first_name="New",
        last_name="User",
        password=_TEST_PASSWORD,
    )


@pytest.fixture
def db() -> Generator[Session, None, None]:
    session = _session()
    try:
        yield session
    finally:
        session.close()


def test_register_sends_verification_email(db: Session) -> None:
    service = _service(db)
    sent: list[tuple[str, str]] = []

    def capture_send(email: str, verify_url: str) -> None:
        sent.append((email, verify_url))

    with (
        patch.object(service, "hash_password", return_value="hashed"),
        patch.object(service.email_verification_mailer, "send_verification_link", side_effect=capture_send),
        patch("secrets.token_urlsafe", return_value=_KNOWN_TOKEN),
    ):
        service.register(_register_request())

    assert len(sent) == 1
    assert sent[0][0] == "new@example.com"
    assert _KNOWN_TOKEN in sent[0][1]

    user = db.scalars(select(User).where(User.email == "new@example.com")).one()
    assert user.email_verified_at is None

    token_row = db.scalars(
        select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.user_id)
    ).one()
    assert token_row.token_hash == _hash_token(_KNOWN_TOKEN)
    assert token_row.used_at is None


def test_verify_email_marks_user_verified_and_records_audit(db: Session) -> None:
    user = _user(db)
    token_hash = _hash_token(_KNOWN_TOKEN)
    db.add(
        EmailVerificationToken(
            user_id=user.user_id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    )
    db.commit()

    service = _service(db)
    service.verify_email(VerifyEmailRequest(token=_KNOWN_TOKEN))

    refreshed = db.get(User, user.user_id)
    assert refreshed is not None
    assert refreshed.email_verified_at is not None

    token_row = db.scalars(
        select(EmailVerificationToken).where(EmailVerificationToken.token_hash == token_hash)
    ).one()
    assert token_row.used_at is not None

    audit = db.scalars(
        select(UserSecurityAuditEvent).where(
            UserSecurityAuditEvent.user_id == user.user_id,
            UserSecurityAuditEvent.event_type == "email_verified",
        )
    ).one()
    assert audit.detail == user.email


def test_verify_email_rejects_expired_token(db: Session) -> None:
    user = _user(db)
    db.add(
        EmailVerificationToken(
            user_id=user.user_id,
            token_hash=_hash_token(_KNOWN_TOKEN),
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
    )
    db.commit()

    service = _service(db)
    with pytest.raises(ValueError, match="INVALID_OR_EXPIRED_VERIFICATION_TOKEN"):
        service.verify_email(VerifyEmailRequest(token=_KNOWN_TOKEN))


def test_verify_email_rejects_used_token(db: Session) -> None:
    user = _user(db)
    db.add(
        EmailVerificationToken(
            user_id=user.user_id,
            token_hash=_hash_token(_KNOWN_TOKEN),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            used_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    service = _service(db)
    with pytest.raises(ValueError, match="INVALID_OR_EXPIRED_VERIFICATION_TOKEN"):
        service.verify_email(VerifyEmailRequest(token=_KNOWN_TOKEN))


def test_resend_invalidates_previous_token_and_sends_new_one(db: Session) -> None:
    user = _user(db)
    old_hash = _hash_token("old-token")
    db.add(
        EmailVerificationToken(
            user_id=user.user_id,
            token_hash=old_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    )
    db.commit()

    service = _service(db)
    tokens_seen: list[str] = []

    with patch("secrets.token_urlsafe", side_effect=["new-token-1", "new-token-2"]):
        with patch.object(
            service.email_verification_mailer,
            "send_verification_link",
            side_effect=lambda _email, url: tokens_seen.append(url),
        ):
            service.resend_verification_email(user.user_id)

    old_row = db.scalars(
        select(EmailVerificationToken).where(EmailVerificationToken.token_hash == old_hash)
    ).one()
    assert old_row.used_at is not None

    active_rows = db.scalars(
        select(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user.user_id,
            EmailVerificationToken.used_at.is_(None),
        )
    ).all()
    assert len(active_rows) == 1
    assert active_rows[0].token_hash == _hash_token("new-token-1")
    assert "new-token-1" in tokens_seen[0]


def test_update_profile_email_change_clears_verification_and_resends(db: Session) -> None:
    user = _user(db, email_verified_at=datetime.now(timezone.utc))
    access_token = _access_token(user.user_id)
    service = _service(db)
    sent: list[str] = []

    with (
        patch.object(
            service.email_verification_mailer,
            "send_verification_link",
            side_effect=lambda email, _url: sent.append(email),
        ),
        patch("secrets.token_urlsafe", return_value=_KNOWN_TOKEN),
    ):
        response = service.update_profile(
            access_token,
            ProfileUpdateRequest(email="changed@example.com"),
        )

    assert response is not None
    assert response.user.email == "changed@example.com"
    assert response.user.email_verified_at is None
    assert sent == ["changed@example.com"]

    refreshed = db.get(User, user.user_id)
    assert refreshed is not None
    assert refreshed.email_verified_at is None

    audit = db.scalars(
        select(UserSecurityAuditEvent).where(
            UserSecurityAuditEvent.user_id == user.user_id,
            UserSecurityAuditEvent.event_type == "email_changed",
        )
    ).one()
    assert audit.detail == "changed@example.com"


def test_admin_created_user_is_auto_verified(db: Session) -> None:
    repo = MagicMock()
    captured: dict = {}

    def create(user: User) -> User:
        captured["email_verified_at"] = user.email_verified_at
        user.user_id = 99
        return user

    repo.user_role_exists.return_value = True
    repo.user_status_exists.return_value = True
    repo.create.side_effect = create

    service = UserService(repo)
    with patch.object(service, "_hash_password", return_value="hashed"):
        service.create_user(
            UserCreateRequest(
                email="admin-created@example.com",
                first_name="Admin",
                last_name="Created",
                password=_TEST_PASSWORD,
                status_id=1,
                user_role_id=1,
            )
        )

    assert captured["email_verified_at"] is not None


def test_unverified_user_gets_403_on_create_transaction(db: Session) -> None:
    user = _user(db, email_verified_at=None)
    token = _access_token(user.user_id)

    def override_db() -> Generator[Session, None, None]:
        yield db

    app = create_app()
    app.dependency_overrides[get_transaction_service] = lambda: FakeTransactionService()
    from database import get_db

    app.dependency_overrides[get_db] = override_db
    try:
        client = TestClient(app)
        resp = client.post(
            "/transactions",
            json={
                "sender_card_id": 1,
                "recipient_card_id": 2,
                "transaction_type_id": 1,
                "amount": "10.00",
                "idempotency_key": "verify-gate-test",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
        assert "verify your email" in resp.json()["message"].lower()
    finally:
        app.dependency_overrides.clear()


def test_verified_user_can_create_transaction(db: Session) -> None:
    user = _user(db, email_verified_at=datetime.now(timezone.utc))
    token = _access_token(user.user_id)

    def override_db() -> Generator[Session, None, None]:
        yield db

    app = create_app()
    app.dependency_overrides[get_transaction_service] = lambda: FakeTransactionService()
    from database import get_db

    app.dependency_overrides[get_db] = override_db
    try:
        client = TestClient(app)
        resp = client.post(
            "/transactions",
            json={
                "sender_card_id": 1,
                "recipient_card_id": 2,
                "transaction_type_id": 1,
                "amount": "10.00",
                "idempotency_key": "verified-create-test",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
    finally:
        app.dependency_overrides.clear()
