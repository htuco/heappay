"""Tests for the staff transaction lookup-by-id route."""
from datetime import datetime, timezone
from decimal import Decimal
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from fastapi.testclient import TestClient  # noqa: E402

from main import create_app  # noqa: E402
from routes.dependencies import require_staff  # noqa: E402
from routes.transaction.transaction import get_transaction_service  # noqa: E402

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
    def __init__(self, transaction_id: int) -> None:
        self.transaction_id = transaction_id
        self.sender_card_id = 1
        self.recipient_card_id = 2
        self.transaction_type_id = 1
        self.status_id = 1
        self.amount = Decimal("10.00")
        self.note = None
        self.idempotency_key = None
        self.created_at = _NOW
        self.processing_eligible_at = _NOW
        self.sender_card = _FakeCard(1)
        self.recipient_card = _FakeCard(2)
        self.refund_detail = None


class FakeTransactionService:
    def __init__(self) -> None:
        self._rows = {42: _FakeTransaction(42)}

    def get_by_id_staff(self, transaction_id: int):
        return self._rows.get(transaction_id)


def _client(*, staff: bool = True) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_transaction_service] = lambda: FakeTransactionService()
    if staff:
        app.dependency_overrides[require_staff] = lambda: 1
    return TestClient(app)


def test_staff_lookup_returns_transaction() -> None:
    client = _client()
    response = client.get("/transactions/42/staff")
    assert response.status_code == 200
    assert response.json()["data"]["transaction_id"] == 42


def test_staff_lookup_missing_returns_404() -> None:
    client = _client()
    response = client.get("/transactions/999/staff")
    assert response.status_code == 404
    assert response.json()["message"] == "Transaction not found."


def test_staff_lookup_requires_staff() -> None:
    # No require_staff override → the real dependency runs without auth → 401/403.
    client = _client(staff=False)
    response = client.get("/transactions/42/staff")
    assert response.status_code in (401, 403)
