"""
Regression: soft-deleted (deactivated) users must not use refresh or access tokens.

Covers resolve_active_user_id, GET /cards/lookup auth dependency, and naming
for /auth/me and /auth/refresh rejection (see test_auth_router).
"""
from datetime import datetime, timezone
import os
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from fastapi.testclient import TestClient  # noqa: E402

from database import get_db  # noqa: E402
from main import create_app  # noqa: E402
from services.auth import UserAuthService  # noqa: E402


def test_resolve_active_user_id_returns_none_when_user_deleted() -> None:
    repo = MagicMock()
    repo.get_user_by_id.return_value = MagicMock(
        user_id=9,
        deleted_at=datetime.now(timezone.utc),
    )
    svc = UserAuthService(repo)
    with patch.object(UserAuthService, "verify_access_token", return_value=9):
        assert svc.resolve_active_user_id("any-access-token") is None


def test_resolve_active_user_id_returns_id_when_user_active() -> None:
    repo = MagicMock()
    repo.get_user_by_id.return_value = MagicMock(user_id=3, deleted_at=None)
    svc = UserAuthService(repo)
    with patch.object(UserAuthService, "verify_access_token", return_value=3):
        assert svc.resolve_active_user_id("any-access-token") == 3


def test_cards_lookup_returns_401_when_session_not_active(monkeypatch) -> None:
    """Protected route uses get_current_user_id → resolve_active_user_id."""

    def fake_db():
        yield MagicMock()

    app = create_app()
    app.dependency_overrides[get_db] = fake_db
    monkeypatch.setattr(
        "services.auth.UserAuthService.resolve_active_user_id",
        lambda self, token: None,
    )
    try:
        client = TestClient(app)
        resp = client.get(
            "/cards/lookup",
            params={"card_number": "4111111111111111"},
            headers={"Authorization": "Bearer stale-access-token"},
        )
        assert resp.status_code == 401
        body = resp.json()
        assert body.get("code") == "UNAUTHORIZED"
    finally:
        app.dependency_overrides.pop(get_db, None)
