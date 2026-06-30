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
from schemas.user.auth import AppPinStatusResponse, TokenResponse, UserResponse  # noqa: E402
from schemas.user.biometric import (  # noqa: E402
    BiometricAuthenticationOptionsResponse,
    BiometricCredentialResponse,
    BiometricRegistrationOptionsResponse,
    BiometricStatusResponse,
)
from utils.password_policy import PASSWORD_RULES_MESSAGE  # noqa: E402


_NOW = datetime.now(timezone.utc)


def _user_response(role_id: int = 2, role_name: str = "user", status_id: int = 1) -> UserResponse:
    return UserResponse(
        id=42,
        email="test@example.com",
        first_name="Test",
        last_name="User",
        created_at=_NOW,
        status_id=status_id,
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

    def resolve_active_user_id(self, _token):
        return 42

    def get_me(self, _token):
        return _token_response()

    def update_profile(self, _token, _payload):
        return _token_response()

    def update_notification_preferences(self, _token, _enabled):
        return _token_response()

    def update_payment_security_preferences(self, _token, _payload):
        return _token_response()

    def add_recovery_email(self, _user_id, _payload):
        return None

    def change_recovery_email(self, _user_id, _payload):
        return None

    def resend_recovery_email_verification(self, _user_id):
        return None

    def verify_recovery_email(self, _payload):
        return None

    def remove_recovery_email(self, _user_id, _payload):
        return None

    def change_password(self, _user_id, _payload):
        return None

    def request_password_reset(self, _payload):
        return None

    def confirm_password_reset(self, _payload):
        return None

    def get_biometric_status(self, _user_id):
        return BiometricStatusResponse(enabled=False, credential_count=0)

    def begin_biometric_registration(self, _user_id):
        return BiometricRegistrationOptionsResponse(
            challenge_id=7,
            publicKey={"challenge": "abc", "rp": {"id": "localhost", "name": "Heap"}},
        )

    def complete_biometric_registration(self, _user_id, _payload):
        return BiometricCredentialResponse(
            credential_id="credential-1",
            device_type="single_device",
            backed_up=False,
        )

    def begin_biometric_disable(self, _user_id):
        return BiometricAuthenticationOptionsResponse(
            challenge_id=8,
            publicKey={"challenge": "abc", "rpId": "localhost", "allowCredentials": []},
        )

    def complete_biometric_disable(self, _user_id, _payload):
        return BiometricStatusResponse(enabled=False, credential_count=0)

    def disable_biometric_authentication(self, _user_id):
        return BiometricStatusResponse(enabled=False, credential_count=0)

    def get_app_pin_status(self, _user_id):
        return AppPinStatusResponse(
            enabled=False,
            locked=False,
            locked_until=None,
            failed_attempts_remaining=5,
        )

    def set_app_pin(self, _user_id, _payload):
        return AppPinStatusResponse(
            enabled=True,
            locked=False,
            locked_until=None,
            failed_attempts_remaining=5,
        )

    def change_app_pin(self, _user_id, _payload):
        return AppPinStatusResponse(
            enabled=True,
            locked=False,
            locked_until=None,
            failed_attempts_remaining=5,
        )

    def disable_app_pin(self, _user_id, _payload):
        return AppPinStatusResponse(
            enabled=False,
            locked=False,
            locked_until=None,
            failed_attempts_remaining=5,
        )


class _FakeAuthServiceAdmin:
    def login(self, _payload):
        return _token_response(role_id=1, role_name="admin")

    def get_me(self, _token):
        return _token_response(role_id=1, role_name="admin")

    def update_profile(self, _token, _payload):
        return _token_response(role_id=1, role_name="admin")

    def update_notification_preferences(self, _token, _enabled):
        return _token_response(role_id=1, role_name="admin")

    def update_payment_security_preferences(self, _token, _payload):
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
            "password": "Password123!",
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
            "password": "Password123!",
        },
    )
    data = resp.json()["data"]
    assert "access_token" in data
    assert "refresh_token" in data


def test_register_rejects_weak_password() -> None:
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
    assert resp.status_code == 422
    assert resp.json()["details"][0]["msg"] == PASSWORD_RULES_MESSAGE


def test_register_hcaptcha_failure_returns_friendly_error(monkeypatch) -> None:
    from routes.user import auth as auth_route_module

    def fail_hcaptcha(_request, _token):
        raise auth_route_module.InvalidInput(auth_route_module.HCAPTCHA_FAILURE_MESSAGE)

    monkeypatch.setattr(auth_route_module, "verify_auth_hcaptcha", fail_hcaptcha)
    client = _build_client()
    resp = client.post(
        "/auth/register",
        json={
            "email": "new@example.com",
            "first_name": "New",
            "last_name": "User",
            "password": "Password123!",
        },
    )
    assert resp.status_code == 400
    assert resp.json()["message"] == "Please complete the security check and try again."


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


def test_login_hcaptcha_failure_returns_friendly_error(monkeypatch) -> None:
    from routes.user import auth as auth_route_module

    def fail_hcaptcha(_request, _token):
        raise auth_route_module.InvalidInput(auth_route_module.HCAPTCHA_FAILURE_MESSAGE)

    monkeypatch.setattr(auth_route_module, "verify_auth_hcaptcha", fail_hcaptcha)
    client = _build_client()
    resp = client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "password123"},
    )
    assert resp.status_code == 400
    assert resp.json()["message"] == "Please complete the security check and try again."


# ---------------------------------------------------------------------------
# biometrics
# ---------------------------------------------------------------------------


def test_biometric_status_returns_enrolled_state() -> None:
    client = _build_client()
    resp = client.get(
        "/auth/biometrics",
        headers={"Authorization": "Bearer access.token.here"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"enabled": False, "credential_count": 0}


def test_biometric_registration_options_returns_public_key_options() -> None:
    client = _build_client()
    resp = client.post(
        "/auth/biometrics/registration/options",
        headers={"Authorization": "Bearer access.token.here"},
    )
    assert resp.status_code == 200
    assert resp.json()["challenge_id"] == 7
    assert resp.json()["publicKey"]["rp"]["name"] == "Heap"


def test_biometric_registration_complete_returns_credential() -> None:
    client = _build_client()
    resp = client.post(
        "/auth/biometrics/registration/complete",
        headers={"Authorization": "Bearer access.token.here"},
        json={"challenge_id": 7, "credential": {"id": "credential-1"}},
    )
    assert resp.status_code == 200
    assert resp.json()["credential_id"] == "credential-1"


def test_biometric_registration_complete_handles_expired_challenge() -> None:
    class _ExpiredChallengeService(_FakeAuthService):
        def complete_biometric_registration(self, _user_id, _payload):
            raise ValueError("INVALID_OR_EXPIRED_BIOMETRIC_CHALLENGE")

    client = _build_client(_ExpiredChallengeService())
    resp = client.post(
        "/auth/biometrics/registration/complete",
        headers={"Authorization": "Bearer access.token.here"},
        json={"challenge_id": 7, "credential": {"id": "credential-1"}},
    )
    assert resp.status_code == 400
    assert resp.json()["message"] == "Biometric enrollment expired. Try again."


def test_biometric_disable_returns_disabled_status() -> None:
    client = _build_client()
    resp = client.delete(
        "/auth/biometrics",
        headers={"Authorization": "Bearer access.token.here"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"enabled": False, "credential_count": 0}


def test_biometric_disable_options_returns_public_key_options() -> None:
    client = _build_client()
    resp = client.post(
        "/auth/biometrics/disable/options",
        headers={"Authorization": "Bearer access.token.here"},
    )
    assert resp.status_code == 200
    assert resp.json()["challenge_id"] == 8
    assert resp.json()["publicKey"]["rpId"] == "localhost"


def test_biometric_disable_complete_returns_disabled_status() -> None:
    client = _build_client()
    resp = client.post(
        "/auth/biometrics/disable/complete",
        headers={"Authorization": "Bearer access.token.here"},
        json={"challenge_id": 8, "credential": {"id": "credential-1"}},
    )
    assert resp.status_code == 200
    assert resp.json() == {"enabled": False, "credential_count": 0}


# ---------------------------------------------------------------------------
# app PIN
# ---------------------------------------------------------------------------


def test_app_pin_status_returns_current_state() -> None:
    client = _build_client()
    resp = client.get(
        "/auth/app-pin",
        headers={"Authorization": "Bearer access.token.here"},
    )
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False
    assert resp.json()["failed_attempts_remaining"] == 5


def test_app_pin_set_returns_enabled_state() -> None:
    client = _build_client()
    resp = client.post(
        "/auth/app-pin",
        headers={"Authorization": "Bearer access.token.here"},
        json={
            "current_password": "Password123!",
            "pin": "1234",
            "confirm_pin": "1234",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["enabled"] is True


def test_app_pin_set_wrong_password_returns_friendly_error() -> None:
    class _WrongPasswordService(_FakeAuthService):
        def set_app_pin(self, _user_id, _payload):
            raise ValueError("WRONG_CURRENT_PASSWORD")

    client = _build_client(_WrongPasswordService())
    resp = client.post(
        "/auth/app-pin",
        headers={"Authorization": "Bearer access.token.here"},
        json={
            "current_password": "wrong",
            "pin": "1234",
            "confirm_pin": "1234",
        },
    )
    assert resp.status_code == 400
    assert resp.json()["message"] == "Current password is incorrect."


def test_app_pin_change_locked_returns_friendly_error() -> None:
    class _LockedPinService(_FakeAuthService):
        def change_app_pin(self, _user_id, _payload):
            raise ValueError("APP_PIN_LOCKED")

    client = _build_client(_LockedPinService())
    resp = client.patch(
        "/auth/app-pin",
        headers={"Authorization": "Bearer access.token.here"},
        json={
            "current_pin": "1234",
            "new_pin": "4321",
            "confirm_pin": "4321",
        },
    )
    assert resp.status_code == 400
    assert resp.json()["message"] == "App PIN is locked. Try again later."


def test_app_pin_disable_returns_disabled_state() -> None:
    client = _build_client()
    resp = client.request(
        "DELETE",
        "/auth/app-pin",
        headers={"Authorization": "Bearer access.token.here"},
        json={"current_pin": "1234"},
    )
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False


def test_app_pin_disable_wrong_pin_returns_friendly_error() -> None:
    class _WrongPinService(_FakeAuthService):
        def disable_app_pin(self, _user_id, _payload):
            raise ValueError("INVALID_APP_PIN")

    client = _build_client(_WrongPinService())
    resp = client.request(
        "DELETE",
        "/auth/app-pin",
        headers={"Authorization": "Bearer access.token.here"},
        json={"current_pin": "0000"},
    )
    assert resp.status_code == 400
    assert resp.json()["message"] == "Current app PIN is incorrect."


# ---------------------------------------------------------------------------
# password reset request
# ---------------------------------------------------------------------------


def test_password_reset_request_hcaptcha_failure_returns_friendly_error(monkeypatch) -> None:
    from routes.user import auth as auth_route_module

    def fail_hcaptcha(_request, _token):
        raise auth_route_module.InvalidInput(auth_route_module.HCAPTCHA_FAILURE_MESSAGE)

    monkeypatch.setattr(auth_route_module, "verify_auth_hcaptcha", fail_hcaptcha)
    client = _build_client()
    resp = client.post(
        "/auth/password-reset/request",
        json={"email": "test@example.com"},
    )
    assert resp.status_code == 400
    assert resp.json()["message"] == "Please complete the security check and try again."


# ---------------------------------------------------------------------------
# password strength
# ---------------------------------------------------------------------------


def test_change_password_rejects_weak_new_password() -> None:
    client = _build_client()
    resp = client.post(
        "/auth/change-password",
        headers={"Authorization": "Bearer access.token.here"},
        json={
            "current_password": "OldPassword123!",
            "new_password": "password123",
            "confirm_password": "password123",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["details"][0]["msg"] == PASSWORD_RULES_MESSAGE


def test_password_reset_confirm_rejects_weak_new_password() -> None:
    client = _build_client()
    resp = client.post(
        "/auth/password-reset/confirm",
        json={
            "token": "a" * 32,
            "new_password": "password123",
            "confirm_password": "password123",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["details"][0]["msg"] == PASSWORD_RULES_MESSAGE


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
        last_payload = None

        def update_notification_preferences(self, _token, payload):
            self.last_payload = payload
            return _token_response()

    service = _NotifService()
    client = _build_client(service)
    resp = client.patch(
        "/auth/notification-preferences",
        headers={"Authorization": "Bearer access.token.here"},
        json={
            "billing_reminders_enabled": False,
            "email_payment_sent_enabled": False,
            "email_topup_enabled": True,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Notification preferences updated."
    assert service.last_payload.billing_reminders_enabled is False
    assert service.last_payload.email_payment_sent_enabled is False
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
        def update_notification_preferences(self, _token, _payload):
            return None

    client = _build_client(_NoNotifService())
    resp = client.patch(
        "/auth/notification-preferences",
        headers={"Authorization": "Bearer stale.access"},
        json={"billing_reminders_enabled": True},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PATCH /payment-security-preferences
# ---------------------------------------------------------------------------


def test_update_payment_security_preferences_persists_flag() -> None:
    class _SecurityService(_FakeAuthService):
        last_payload = None

        def update_payment_security_preferences(self, _token, payload):
            self.last_payload = payload
            return _token_response()

    service = _SecurityService()
    client = _build_client(service)
    resp = client.patch(
        "/auth/payment-security-preferences",
        headers={"Authorization": "Bearer access.token.here"},
        json={
            "payment_confirm_enabled": True,
            "payment_confirm_above_amount": "10.00",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Payment security preferences updated."
    assert service.last_payload.payment_confirm_enabled is True
    assert str(service.last_payload.payment_confirm_above_amount) == "10.00"


# ---------------------------------------------------------------------------
# Recovery email
# ---------------------------------------------------------------------------


def test_add_recovery_email_returns_200() -> None:
    class _RecoveryService(_FakeAuthService):
        last_user_id = None
        last_payload = None

        def add_recovery_email(self, user_id, payload):
            self.last_user_id = user_id
            self.last_payload = payload

    service = _RecoveryService()
    client = _build_client(service)
    resp = client.post(
        "/auth/recovery-email",
        headers={"Authorization": "Bearer access.token.here"},
        json={"email": "recovery@example.com"},
    )
    assert resp.status_code == 200
    assert service.last_user_id == 42
    assert str(service.last_payload.email) == "recovery@example.com"


def test_verify_recovery_email_returns_200() -> None:
    class _VerifyService(_FakeAuthService):
        last_token = None

        def verify_recovery_email(self, payload):
            self.last_token = payload.token

    service = _VerifyService()
    client = _build_client(service)
    resp = client.post(
        "/auth/recovery-email/verify",
        json={"token": "a" * 48},
    )
    assert resp.status_code == 200
    assert service.last_token == "a" * 48


def test_remove_recovery_email_requires_step_up_payload() -> None:
    client = _build_client()
    resp = client.request(
        "DELETE",
        "/auth/recovery-email",
        headers={"Authorization": "Bearer access.token.here"},
        json={},
    )
    assert resp.status_code == 422


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
