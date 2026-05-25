"""
Tests for /auth endpoints.

Focus: role fields (user_role_id, role_name) appear in every auth response
that contains a user object — register, login, refresh, and /me.
"""
from datetime import datetime, timezone
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from fastapi.testclient import TestClient  # noqa: E402

from main import create_app  # noqa: E402
from routes.user.auth import get_auth_service  # noqa: E402
from schemas.user.auth import TokenResponse, UserResponse  # noqa: E402


_NOW = datetime.now(timezone.utc)


def _user_response(role_id: int = 2, role_name: str = "user") -> UserResponse:
    return UserResponse(
        id=42,
        email="test@example.com",
        first_name="Test",
        last_name="User",
        created_at=_NOW,
        user_role_id=role_id,
        role_name=role_name,
        billing_reminders_enabled=True,
        avatar_url=None,
    )


def _token_response(role_id: int = 2, role_name: str = "user") -> TokenResponse:
    return TokenResponse(
        access_token="access.token.here",
        refresh_token="refresh.token.here",
        token_type="bearer",
        user=_user_response(role_id, role_name),
    )


class _FakeAuthService:
    def register(self, _payload):
        return _token_response()

    def login(self, _payload):
        return _token_response()

    def refresh(self, _token):
        return _token_response()

    def logout(self, _token):
        return True

    def get_me(self, _token):
        return _token_response()

    def update_profile(self, _token, _payload):
        return _token_response()

    def update_notification_preferences(self, _token, _enabled):
        return _token_response()


class _FakeAuthServiceAdmin:
    def login(self, _payload):
        return _token_response(role_id=1, role_name="admin")

    def get_me(self, _token):
        return _token_response(role_id=1, role_name="admin")

    def update_profile(self, _token, _payload):
        return _token_response(role_id=1, role_name="admin")

    def update_notification_preferences(self, _token, _enabled):
        return _token_response(role_id=1, role_name="admin")

    def register(self, _payload):  # pragma: no cover
        return _token_response(role_id=1, role_name="admin")

    def refresh(self, _token):  # pragma: no cover
        return _token_response(role_id=1, role_name="admin")

    def logout(self, _token):  # pragma: no cover
        return True


def _build_client(fake_service=None) -> TestClient:
    app = create_app()
    svc = fake_service or _FakeAuthService()
    app.dependency_overrides[get_auth_service] = lambda: svc
    return TestClient(app)


# ---------------------------------------------------------------------------
# register
# ---------------------------------------------------------------------------

def test_register_returns_201_with_role_fields() -> None:
    client = _build_client()
    resp = client.post(
        "/auth/register",
        json={
            "email": "new@example.com",
            "first_name": "New",
            "last_name": "User",
            "password": "password123",
        },
    )
    assert resp.status_code == 201
    user = resp.json()["data"]["user"]
    assert user["user_role_id"] == 2
    assert user["role_name"] == "user"


def test_register_response_has_tokens() -> None:
    client = _build_client()
    resp = client.post(
        "/auth/register",
        json={
            "email": "new@example.com",
            "first_name": "New",
            "last_name": "User",
            "password": "password123",
        },
    )
    data = resp.json()["data"]
    assert "access_token" in data
    assert "refresh_token" in data


# ---------------------------------------------------------------------------
# login
# ---------------------------------------------------------------------------

def test_login_returns_200_with_role_fields() -> None:
    client = _build_client()
    resp = client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )
    assert resp.status_code == 200
    user = resp.json()["data"]["user"]
    assert user["user_role_id"] == 2
    assert user["role_name"] == "user"


def test_login_admin_returns_admin_role() -> None:
    client = _build_client(_FakeAuthServiceAdmin())
    resp = client.post(
        "/auth/login",
        json={"email": "admin@example.com", "password": "password123"},
    )
    assert resp.status_code == 200
    user = resp.json()["data"]["user"]
    assert user["user_role_id"] == 1
    assert user["role_name"] == "admin"


def test_login_invalid_credentials_returns_401() -> None:
    class _FailService(_FakeAuthService):
        def login(self, _payload):
            raise ValueError("Invalid email or password")

    client = _build_client(_FailService())
    resp = client.post(
        "/auth/login",
        json={"email": "bad@example.com", "password": "wrongpassword"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# /me
# ---------------------------------------------------------------------------

def test_me_returns_200_with_role_fields() -> None:
    client = _build_client()
    resp = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer access.token.here"},
    )
    assert resp.status_code == 200
    user = resp.json()["data"]["user"]
    assert "user_role_id" in user
    assert "role_name" in user


def test_me_admin_returns_admin_role() -> None:
    client = _build_client(_FakeAuthServiceAdmin())
    resp = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer admin.token.here"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["user"]["role_name"] == "admin"


def test_me_without_token_returns_401() -> None:
    client = _build_client()
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_me_invalid_token_returns_401() -> None:
    class _NoUserService(_FakeAuthService):
        def get_me(self, _token):
            return None

    client = _build_client(_NoUserService())
    resp = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer expired.or.invalid"},
    )
    assert resp.status_code == 401


def test_me_rejects_deactivated_user_returns_401() -> None:
    """Same contract as invalid/expired token: deactivated users get 401 on /auth/me."""

    class _DeactivatedMeService(_FakeAuthService):
        def get_me(self, _token):
            return None

    client = _build_client(_DeactivatedMeService())
    resp = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer stale.after.deactivate"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PATCH /me
# ---------------------------------------------------------------------------

def test_update_me_patches_current_user_profile() -> None:
    class _UpdateService(_FakeAuthService):
        payload = None

        def update_profile(self, _token, payload):
            self.payload = payload
            return _token_response()

    service = _UpdateService()
    client = _build_client(service)
    resp = client.patch(
        "/auth/me",
        headers={"Authorization": "Bearer access.token.here"},
        json={
            "first_name": "Updated",
            "last_name": "Person",
            "email": "updated@example.com",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Profile updated successfully."
    assert service.payload.first_name == "Updated"
    assert service.payload.last_name == "Person"
    assert service.payload.email == "updated@example.com"


def test_update_me_without_token_returns_401() -> None:
    client = _build_client()
    resp = client.patch(
        "/auth/me",
        json={
            "first_name": "Updated",
            "last_name": "Person",
            "email": "updated@example.com",
        },
    )
    assert resp.status_code == 401


def test_update_me_duplicate_email_returns_400() -> None:
    class _DuplicateEmailService(_FakeAuthService):
        def update_profile(self, _token, _payload):
            raise ValueError("EMAIL_NOT_AVAILABLE")

    client = _build_client(_DuplicateEmailService())
    resp = client.patch(
        "/auth/me",
        headers={"Authorization": "Bearer access.token.here"},
        json={
            "first_name": "Updated",
            "last_name": "Person",
            "email": "taken@example.com",
        },
    )
    assert resp.status_code == 400
    assert resp.json()["message"] == "An account with this email already exists."


# ---------------------------------------------------------------------------
# PATCH /notification-preferences
# ---------------------------------------------------------------------------


def test_update_notification_preferences_persists_flag() -> None:
    class _NotifService(_FakeAuthService):
        last_enabled = None

        def update_notification_preferences(self, _token, enabled):
            self.last_enabled = enabled
            return _token_response()

    service = _NotifService()
    client = _build_client(service)
    resp = client.patch(
        "/auth/notification-preferences",
        headers={"Authorization": "Bearer access.token.here"},
        json={"billing_reminders_enabled": False},
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Notification preferences updated."
    assert service.last_enabled is False
    assert "billing_reminders_enabled" in resp.json()["data"]["user"]


def test_update_notification_preferences_without_token_returns_401() -> None:
    client = _build_client()
    resp = client.patch(
        "/auth/notification-preferences",
        json={"billing_reminders_enabled": True},
    )
    assert resp.status_code == 401


def test_update_notification_preferences_invalid_session_returns_401() -> None:
    class _NoNotifService(_FakeAuthService):
        def update_notification_preferences(self, _token, _enabled):
            return None

    client = _build_client(_NoNotifService())
    resp = client.patch(
        "/auth/notification-preferences",
        headers={"Authorization": "Bearer stale.access"},
        json={"billing_reminders_enabled": True},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# refresh
# ---------------------------------------------------------------------------

def test_refresh_returns_200_with_role_fields() -> None:
    client = _build_client()
    resp = client.post(
        "/auth/refresh",
        json={"refresh_token": "refresh.token.here"},
    )
    assert resp.status_code == 200
    user = resp.json()["data"]["user"]
    assert "user_role_id" in user
    assert "role_name" in user


def test_refresh_invalid_token_returns_401() -> None:
    class _BadRefreshService(_FakeAuthService):
        def refresh(self, _token):
            return None

    client = _build_client(_BadRefreshService())
    resp = client.post(
        "/auth/refresh",
        json={"refresh_token": "invalid.refresh"},
    )
    assert resp.status_code == 401


def test_refresh_rejects_deactivated_user_returns_401() -> None:
    """Deactivated users cannot rotate tokens; service returns None → 401."""

    class _DeactivatedRefreshService(_FakeAuthService):
        def refresh(self, _token):
            return None

    client = _build_client(_DeactivatedRefreshService())
    resp = client.post(
        "/auth/refresh",
        json={"refresh_token": "stale.after.deactivate"},
    )
    assert resp.status_code == 401
