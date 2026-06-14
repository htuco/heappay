"""Tests for transaction create idempotency."""
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


_NOW = datetime.now(timezone.utc)


class _FakeUser:
    def __init__(self) -> None:
        self.user_id = 10
        self.email = "user@example.com"
        self.first_name = "Test"
        self.last_name = "User"
        self.avatar_url = None


class _FakeCard:
    def __init__(self, card_id: int) -> None:
        self.card_id = card_id
        self.user_id = 10
        self.last_four = "4242"
        self.cardholder_name = "Test User"
        self.user = _FakeUser()
        self.card_type = type("CardType", (), {"vendor": "visa"})()


class _FakeTransaction:
    def __init__(self, transaction_id: int, *, idempotency_key: str | None = None) -> None:
        self.transaction_id = transaction_id
        self.sender_card_id = 1
        self.recipient_card_id = 2
        self.transaction_type_id = 1
        self.status_id = 1
        self.amount = Decimal("10.00")
        self.note = None
        self.idempotency_key = idempotency_key
        self.created_at = _NOW
        self.processing_eligible_at = _NOW
        self.sender_card = _FakeCard(1)
        self.recipient_card = _FakeCard(2)
        self.refund_detail = None


class FakeTransactionService:
    def __init__(self) -> None:
        self._by_key: dict[str, _FakeTransaction] = {}
        self._next_id = 1

    def create(self, payload: TransactionCreate, *, user_id: int) -> tuple[_FakeTransaction, bool]:
        if payload.idempotency_key and payload.idempotency_key in self._by_key:
            return self._by_key[payload.idempotency_key], False

        row = _FakeTransaction(self._next_id, idempotency_key=payload.idempotency_key)
        self._next_id += 1
        if payload.idempotency_key:
            self._by_key[payload.idempotency_key] = row
        return row, True

    def list_for_user(self, **_kwargs):
        return [], 0

    def get_by_id_for_user(self, transaction_id: int, *, user_id: int):
        return None

    def get_summary_for_user(self, **_kwargs):
        return []

    def list_for_card(self, **_kwargs):
        return [], 0

    def list_all(self, **_kwargs):
        return [], 0

    def patch(self, *_args, **_kwargs):
        raise NotImplementedError

    def patch_as_staff(self, *_args, **_kwargs):
        raise NotImplementedError


def _client(fake: FakeTransactionService) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_transaction_service] = lambda: fake
    app.dependency_overrides[get_current_user_id] = lambda: 10
    return TestClient(app)


def _payload(**overrides):
    base = {
        "sender_card_id": 1,
        "recipient_card_id": 2,
        "transaction_type_id": 1,
        "amount": "10.00",
        "idempotency_key": "pay-attempt-abc",
    }
    base.update(overrides)
    return base


def test_create_returns_201_on_first_request() -> None:
    fake = FakeTransactionService()
    client = _client(fake)
    response = client.post("/transactions", json=_payload())
    assert response.status_code == 201
    assert response.json()["data"]["transaction_id"] == 1


def test_create_returns_200_on_idempotent_replay() -> None:
    fake = FakeTransactionService()
    client = _client(fake)
    first = client.post("/transactions", json=_payload())
    second = client.post("/transactions", json=_payload())
    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["data"]["transaction_id"] == second.json()["data"]["transaction_id"]
