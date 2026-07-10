"""
Tests for strict email validation (utils/email_policy.py).

StrictEmailStr layers local-part, domain-label, and known-TLD checks on top
of EmailStr, and is applied wherever a *new* email is accepted: register,
profile email change, recovery email, and admin user create/update. Login
and password reset stay on plain EmailStr so existing accounts are never
locked out by stricter rules.
"""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

import pytest  # noqa: E402
from pydantic import BaseModel, ValidationError  # noqa: E402

from utils.email_policy import (  # noqa: E402
    EMAIL_DOMAIN_UNSUPPORTED_MESSAGE,
    EMAIL_INVALID_MESSAGE,
    KNOWN_TLDS,
    StrictEmailStr,
)


class _EmailModel(BaseModel):
    email: StrictEmailStr


def _error(email: str) -> dict:
    with pytest.raises(ValidationError) as exc_info:
        _EmailModel(email=email)
    return exc_info.value.errors()[0]


# ---------------------------------------------------------------------------
# validator unit tests
# ---------------------------------------------------------------------------

def test_tld_snapshot_loaded() -> None:
    assert len(KNOWN_TLDS) > 1000
    assert "com" in KNOWN_TLDS
    assert "skj" not in KNOWN_TLDS


@pytest.mark.parametrize(
    "email",
    [
        "dzelila@gmail.com",
        "a.b+tag@sub.example.co.uk",
        "x@y.io",
        "first.last@symphony.is",
        "user_name-1@heap.app",
    ],
)
def test_accepts_real_addresses(email: str) -> None:
    assert _EmailModel(email=email).email == email


def test_accepts_internationalized_tld() -> None:
    # пример.рф — рф is IANA-listed as xn--p1ai
    _EmailModel(email="user@пример.рф")


@pytest.mark.parametrize(
    "email",
    [
        "dzelila@skj.skj",
        "user@domain.skj",
        "user@example.notarealtld",
    ],
)
def test_rejects_unknown_tld(email: str) -> None:
    error = _error(email)
    assert error["type"] == "email_domain_unsupported"
    assert error["msg"] == EMAIL_DOMAIN_UNSUPPORTED_MESSAGE


@pytest.mark.parametrize(
    "email",
    [
        ".leading@gmail.com",
        "trailing.@gmail.com",
        "double..dot@gmail.com",
        "bad chars@gmail.com",
        "a" * 65 + "@gmail.com",
        "user@nodot",
        "user@example.123",
        "user@-hyphen.com",
        "user@hyphen-.com",
        "no-at-sign.com",
    ],
)
def test_rejects_structural_garbage(email: str) -> None:
    # EmailStr catches most of these before our validator; either way the
    # request is rejected with a validation error.
    with pytest.raises(ValidationError):
        _EmailModel(email=email)


def test_structural_failure_reaching_validator_uses_clear_message() -> None:
    from utils.email_policy import validate_email_structure

    with pytest.raises(Exception) as exc_info:
        validate_email_structure("user@nodot")
    assert EMAIL_INVALID_MESSAGE in str(exc_info.value)


# ---------------------------------------------------------------------------
# endpoint coverage — strict where a new email is accepted
# ---------------------------------------------------------------------------

from fastapi.testclient import TestClient  # noqa: E402

from main import create_app  # noqa: E402
from routes.user.auth import get_auth_service  # noqa: E402
from tests.test_auth_router import _FakeAuthService, _token_response  # noqa: E402


def _build_client() -> TestClient:
    app = create_app()
    app.dependency_overrides[get_auth_service] = lambda: _FakeAuthService()
    return TestClient(app)


def _register_payload(email: str) -> dict:
    return {
        "email": email,
        "first_name": "New",
        "last_name": "User",
        "password": "Password123!",
    }


def test_register_rejects_unknown_tld() -> None:
    client = _build_client()
    resp = client.post("/auth/register", json=_register_payload("dzelila@skj.skj"))
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert body["details"][0]["msg"] == EMAIL_DOMAIN_UNSUPPORTED_MESSAGE


def test_register_accepts_real_domain() -> None:
    client = _build_client()
    resp = client.post("/auth/register", json=_register_payload("new@example.com"))
    # not a validation rejection (the local env may still 400 on the
    # hcaptcha check, which runs after schema validation)
    assert resp.status_code != 422


def test_profile_update_rejects_unknown_tld() -> None:
    client = _build_client()
    resp = client.patch(
        "/auth/me",
        headers={"Authorization": "Bearer access.token.here"},
        json={"email": "updated@skj.skj"},
    )
    assert resp.status_code == 422
    assert resp.json()["details"][0]["msg"] == EMAIL_DOMAIN_UNSUPPORTED_MESSAGE


def test_add_recovery_email_rejects_unknown_tld() -> None:
    client = _build_client()
    resp = client.post(
        "/auth/recovery-email",
        headers={"Authorization": "Bearer access.token.here"},
        json={"email": "recovery@skj.skj"},
    )
    assert resp.status_code == 422
    assert resp.json()["details"][0]["msg"] == EMAIL_DOMAIN_UNSUPPORTED_MESSAGE


def test_change_recovery_email_rejects_unknown_tld() -> None:
    client = _build_client()
    resp = client.patch(
        "/auth/recovery-email",
        headers={"Authorization": "Bearer access.token.here"},
        json={"email": "recovery@skj.skj"},
    )
    assert resp.status_code == 422
    assert resp.json()["details"][0]["msg"] == EMAIL_DOMAIN_UNSUPPORTED_MESSAGE


# ---------------------------------------------------------------------------
# lookups of existing emails stay lenient
# ---------------------------------------------------------------------------

def test_login_does_not_apply_strict_tld_check() -> None:
    client = _build_client()
    resp = client.post(
        "/auth/login",
        json={"email": "legacy@heap.demo", "password": "whatever1!"},
    )
    # must not be a validation error — the fake service logs it in fine
    assert resp.status_code == 200


def test_password_reset_request_does_not_apply_strict_tld_check() -> None:
    client = _build_client()
    resp = client.post(
        "/auth/password-reset/request",
        json={"email": "legacy@heap.demo"},
    )
    assert resp.status_code != 422


# ---------------------------------------------------------------------------
# admin create/update schemas
# ---------------------------------------------------------------------------

def test_admin_user_create_schema_rejects_unknown_tld() -> None:
    from schemas.user.crud import UserCreateRequest

    with pytest.raises(ValidationError) as exc_info:
        UserCreateRequest(
            email="admin.created@skj.skj",
            first_name="Admin",
            last_name="Created",
            password="Password123!",
            status_id=1,
            user_role_id=2,
        )
    assert exc_info.value.errors()[0]["msg"] == EMAIL_DOMAIN_UNSUPPORTED_MESSAGE


def test_admin_user_update_schema_rejects_unknown_tld() -> None:
    from schemas.user.crud import UserUpdateRequest

    with pytest.raises(ValidationError) as exc_info:
        UserUpdateRequest(email="admin.updated@skj.skj")
    assert exc_info.value.errors()[0]["msg"] == EMAIL_DOMAIN_UNSUPPORTED_MESSAGE


def test_admin_user_update_schema_accepts_real_domain() -> None:
    from schemas.user.crud import UserUpdateRequest

    assert UserUpdateRequest(email="ana@example.com").email == "ana@example.com"
