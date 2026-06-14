"""Rate-limit tests for the brute-forceable auth routes.

Login / register / refresh are throttled by slowapi. Once the per-IP budget is
exhausted the route must answer 429 instead of letting an attacker keep guessing.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from fastapi.testclient import TestClient  # noqa: E402

from main import create_app  # noqa: E402
from ratelimit import AUTH_RATE_LIMIT, limiter  # noqa: E402
from routes.user.auth import get_auth_service  # noqa: E402
from tests.test_auth_router import _FakeAuthService  # noqa: E402

_LIMIT = int(AUTH_RATE_LIMIT.split("/")[0])


def _build_client() -> TestClient:
    app = create_app()
    app.dependency_overrides[get_auth_service] = lambda: _FakeAuthService()
    return TestClient(app)


def test_login_is_rate_limited_after_budget_exhausted() -> None:
    limiter.reset()  # clear any counts bled in from other tests
    client = _build_client()
    payload = {"email": "test@example.com", "password": "Password123!"}

    for _ in range(_LIMIT):
        assert client.post("/auth/login", json=payload).status_code == 200

    blocked = client.post("/auth/login", json=payload)
    assert blocked.status_code == 429
    assert blocked.json()["code"] == "RATE_LIMITED"


def test_register_is_rate_limited() -> None:
    limiter.reset()
    client = _build_client()
    payload = {
        "email": "new@example.com",
        "password": "Password123!",
        "first_name": "New",
        "last_name": "User",
    }

    statuses = {client.post("/auth/register", json=payload).status_code for _ in range(_LIMIT + 2)}
    assert 429 in statuses
