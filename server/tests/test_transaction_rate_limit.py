"""Rate-limit tests for POST /transactions.

The transaction-create endpoint is throttled by slowapi, keyed by the
authenticated user id (not IP). Once a user exhausts the per-minute budget the
route answers 429; a different user from the same client is unaffected.
"""

from datetime import datetime, timedelta, timezone
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

import jwt  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from main import create_app  # noqa: E402
from ratelimit import TRANSACTION_RATE_LIMIT, limiter  # noqa: E402
from routes.dependencies import get_current_user_id  # noqa: E402
from routes.transaction.transaction import get_transaction_service  # noqa: E402
from settings import get_settings  # noqa: E402
from tests.test_transaction_idempotency import FakeTransactionService  # noqa: E402

_LIMIT = int(TRANSACTION_RATE_LIMIT.split("/")[0])


def _access_token(user_id: int) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _client(fake: FakeTransactionService) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_transaction_service] = lambda: fake
    # The route still resolves the acting user via the normal dependency; the
    # rate-limit key func reads the bearer token independently, so we send a real
    # token to exercise the per-user keying.
    app.dependency_overrides[get_current_user_id] = lambda: 10
    return TestClient(app)


def _payload(idempotency_key: str):
    return {
        "sender_card_id": 1,
        "recipient_card_id": 2,
        "transaction_type_id": 1,
        "amount": "10.00",
        "idempotency_key": idempotency_key,
    }


def _headers(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {_access_token(user_id)}"}


def test_create_is_rate_limited_after_budget_exhausted() -> None:
    limiter.reset()
    client = _client(FakeTransactionService())
    headers = _headers(10)

    for i in range(_LIMIT):
        # Distinct idempotency keys so each call is a genuine create, not a replay.
        resp = client.post("/transactions", json=_payload(f"key-{i}"), headers=headers)
        assert resp.status_code == 201

    blocked = client.post("/transactions", json=_payload("key-over"), headers=headers)
    assert blocked.status_code == 429
    body = blocked.json()
    assert body == {
        "code": "RATE_LIMITED",
        "message": "Too many attempts. Please wait a moment and try again.",
        "details": None,
    }


def test_rate_limit_is_per_user_not_per_ip() -> None:
    limiter.reset()
    client = _client(FakeTransactionService())

    # User A exhausts their budget.
    headers_a = _headers(10)
    for i in range(_LIMIT):
        assert (
            client.post("/transactions", json=_payload(f"a-{i}"), headers=headers_a).status_code
            == 201
        )
    assert client.post("/transactions", json=_payload("a-over"), headers=headers_a).status_code == 429

    # User B (same TestClient / IP) is keyed separately and still gets through.
    headers_b = _headers(99)
    assert client.post("/transactions", json=_payload("b-1"), headers=headers_b).status_code == 201
