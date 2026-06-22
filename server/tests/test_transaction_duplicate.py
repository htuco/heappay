"""Tests for duplicate payment blocking within the configurable time window."""
from datetime import datetime, timezone
from decimal import Decimal
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from fastapi.testclient import TestClient  # noqa: E402

from main import create_app  # noqa: E402
from routes.dependencies import get_current_user_id  # noqa: E402
from routes.transaction.transaction import get_transaction_service  # noqa: E402
from schemas.transaction import TransactionCreate  # noqa: E402
from services.transaction.transaction import DuplicatePaymentError  # noqa: E402


_NOW = datetime.now(timezone.utc)


class _FakeCard:
    def __init__(self, card_id: int) -> None:
        self.card_id = card_id
        self.user_id = 10
        self.last_four = "4242"
        self.cardholder_name = "Test User"
        self.user = type("User", (), {"user_id": 10, "first_name": "Test", "last_name": "User", "email": "u@example.com", "avatar_url": None})()
        self.card_type = type("CardType", (), {"vendor": "visa"})()


class _FakeTransaction:
    def __init__(self, transaction_id: int, *, idempotency_key: str | None = None) -> None:
        self.transaction_id = transaction_id
        self.sender_card_id = 1
        self.recipient_card_id = 2
        self.transaction_type_id = 1
        self.status_id = 1
        self.amount = Decimal("50.00")
        self.note = None
        self.idempotency_key = idempotency_key
        self.created_at = _NOW
        self.processing_eligible_at = _NOW
        self.sender_card = _FakeCard(1)
        self.recipient_card = _FakeCard(2)
        self.refund_detail = None


class _DuplicateBlockingService:
    """Simulates service that blocks duplicates but allows idempotent replays."""

    def __init__(self, *, raise_on_second: bool = True) -> None:
        self._seen: list[tuple] = []
        self._by_key: dict[str, _FakeTransaction] = {}
        self._next_id = 1
        self._raise_on_second = raise_on_second

    def create(self, payload: TransactionCreate, *, user_id: int) -> tuple[_FakeTransaction, bool]:
        # Idempotent replay — same key returns existing
        if payload.idempotency_key and payload.idempotency_key in self._by_key:
            return self._by_key[payload.idempotency_key], False

        key = (payload.sender_card_id, payload.recipient_card_id, str(payload.amount))
        if self._raise_on_second and key in self._seen:
            raise DuplicatePaymentError()

        self._seen.append(key)
        row = _FakeTransaction(self._next_id, idempotency_key=payload.idempotency_key)
        self._next_id += 1
        if payload.idempotency_key:
            self._by_key[payload.idempotency_key] = row
        return row, True

    def list_for_user(self, **_kwargs): return [], 0
    def get_by_id_for_user(self, *_a, **_kw): return None
    def get_summary_for_user(self, **_kwargs): return []
    def list_for_card(self, **_kwargs): return [], 0
    def list_all(self, **_kwargs): return [], 0
    def patch(self, *_args, **_kwargs): raise NotImplementedError
    def patch_as_staff(self, *_args, **_kwargs): raise NotImplementedError


def _client(service) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_transaction_service] = lambda: service
    app.dependency_overrides[get_current_user_id] = lambda: 10
    return TestClient(app)


def _payload(**overrides):
    base = {
        "sender_card_id": 1,
        "recipient_card_id": 2,
        "transaction_type_id": 1,
        "amount": "50.00",
    }
    base.update(overrides)
    return base


def test_first_payment_returns_201() -> None:
    client = _client(_DuplicateBlockingService())
    response = client.post("/transactions", json=_payload())
    assert response.status_code == 201


def test_duplicate_within_window_returns_409() -> None:
    svc = _DuplicateBlockingService()
    client = _client(svc)
    first = client.post("/transactions", json=_payload())
    second = client.post("/transactions", json=_payload())
    assert first.status_code == 201
    assert second.status_code == 409


def test_duplicate_409_has_clear_error_message() -> None:
    svc = _DuplicateBlockingService()
    client = _client(svc)
    client.post("/transactions", json=_payload())
    response = client.post("/transactions", json=_payload())
    assert "similar payment" in response.json()["message"].lower()


def test_idempotent_retry_with_same_key_returns_200_not_409() -> None:
    svc = _DuplicateBlockingService()
    client = _client(svc)
    first = client.post("/transactions", json=_payload(idempotency_key="retry-abc"))
    second = client.post("/transactions", json=_payload(idempotency_key="retry-abc"))
    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["data"]["transaction_id"] == second.json()["data"]["transaction_id"]


def test_different_amount_not_blocked() -> None:
    svc = _DuplicateBlockingService()
    client = _client(svc)
    first = client.post("/transactions", json=_payload(amount="50.00"))
    second = client.post("/transactions", json=_payload(amount="75.00"))
    assert first.status_code == 201
    assert second.status_code == 201


def test_different_recipient_not_blocked() -> None:
    svc = _DuplicateBlockingService()
    client = _client(svc)
    first = client.post("/transactions", json=_payload(recipient_card_id=2))
    second = client.post("/transactions", json=_payload(recipient_card_id=3))
    assert first.status_code == 201
    assert second.status_code == 201
