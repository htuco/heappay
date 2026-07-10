"""Tests for admin-only transaction amount masking."""
from datetime import datetime, timezone
from decimal import Decimal
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from fastapi.testclient import TestClient  # noqa: E402

from main import create_app  # noqa: E402
from routes.dependencies import (  # noqa: E402
    UserContext,
    get_current_user_id,
    get_user_context,
    require_admin,
    require_staff,
)
from routes.request.request import get_request_service  # noqa: E402
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
        self.status_id = 2
        self.amount = Decimal("10.00")
        self.note = None
        self.idempotency_key = None
        self.created_at = _NOW
        self.processing_eligible_at = _NOW
        self.sender_card = _FakeCard(1)
        self.recipient_card = _FakeCard(2)
        self.refund_detail = None


class FakeTransactionService:
    def list_all(self, **_kwargs):
        return [_FakeTransaction(1)], 1

    def get_platform_stats(self, *, months: int, **_kwargs):
        return {
            "monthly": [{"period": "2026-06", "count": 5, "volume": Decimal("100.00")}],
            "by_status": {"completed": 5},
            "by_type": {"payment": 5},
            "total_count": 5,
            "completed_volume": Decimal("500.00"),
            "months": months,
        }

    def list_for_user(self, **_kwargs):
        return [_FakeTransaction(1)], 1

    def get_by_id_staff(self, transaction_id: int):
        return _FakeTransaction(transaction_id) if transaction_id == 42 else None


class _RefundDetail:
    def __init__(self, request_id: int) -> None:
        self.request_id = request_id
        self.transaction_id = 100 + request_id
        self.transaction = type(
            "Tx",
            (),
            {
                "amount": Decimal("25.50"),
                "note": "refund note",
                "sender_card": None,
                "recipient_card": None,
            },
        )()


class _RequestRow:
    def __init__(self, request_id: int) -> None:
        self.request_id = request_id
        self.request_type_id = 1
        self.request_type = type("RequestType", (), {"name": "refund"})()
        self.request_status_id = 1
        self.requester_user_id = 10
        self.requester = None
        self.target_user_id = None
        self.note = None
        self.created_at = _NOW
        self.resolved_at = None
        self.refund_detail = _RefundDetail(request_id)
        self.card_freeze_detail = None


class FakeRequestService:
    def list_refunds(self, *, limit, offset, status_id=None):
        rows = [_RequestRow(1)]
        return rows[offset : offset + limit], len(rows)


def _tx_client(*, is_admin: bool, is_staff: bool = True) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_transaction_service] = lambda: FakeTransactionService()
    app.dependency_overrides[require_staff] = lambda: 1
    app.dependency_overrides[require_admin] = lambda: 1
    app.dependency_overrides[get_user_context] = lambda: UserContext(
        user_id=1,
        is_admin=is_admin,
        is_staff=is_staff,
    )
    return TestClient(app)


def _request_client(*, is_admin: bool) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_request_service] = lambda: FakeRequestService()
    app.dependency_overrides[require_staff] = lambda: 1
    app.dependency_overrides[get_user_context] = lambda: UserContext(
        user_id=1,
        is_admin=is_admin,
        is_staff=True,
    )
    return TestClient(app)


def test_admin_list_all_masks_amounts() -> None:
    client = _tx_client(is_admin=True)
    response = client.get("/transactions/all")
    assert response.status_code == 200
    item = response.json()["data"]["items"][0]
    assert item["amount"] is None
    assert item["amount_hidden"] is True


def test_admin_stats_masks_volume() -> None:
    client = _tx_client(is_admin=True)
    response = client.get("/transactions/stats")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["amounts_hidden"] is True
    assert data["completed_volume"] is None
    assert data["monthly"][0]["volume"] is None
    assert data["monthly"][0]["volume_hidden"] is True
    assert data["total_count"] == 5


def test_admin_staff_user_transactions_masks_amounts() -> None:
    client = _tx_client(is_admin=True)
    response = client.get("/transactions/user/10")
    assert response.status_code == 200
    item = response.json()["data"]["items"][0]
    assert item["amount"] is None
    assert item["amount_hidden"] is True


def test_support_staff_user_transactions_show_amounts() -> None:
    client = _tx_client(is_admin=False, is_staff=True)
    response = client.get("/transactions/user/10")
    assert response.status_code == 200
    item = response.json()["data"]["items"][0]
    assert item["amount"] == "10.00"
    assert item["amount_hidden"] is False


def test_admin_staff_lookup_masks_amount() -> None:
    client = _tx_client(is_admin=True)
    response = client.get("/transactions/42/staff")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["amount"] is None
    assert data["amount_hidden"] is True


def test_support_staff_lookup_shows_amount() -> None:
    client = _tx_client(is_admin=False, is_staff=True)
    response = client.get("/transactions/42/staff")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["amount"] == "10.00"
    assert data["amount_hidden"] is False


def test_user_own_transactions_unmasked() -> None:
    app = create_app()
    app.dependency_overrides[get_transaction_service] = lambda: FakeTransactionService()
    app.dependency_overrides[get_current_user_id] = lambda: 10
    client = TestClient(app)
    response = client.get("/transactions")
    assert response.status_code == 200
    item = response.json()["data"]["items"][0]
    assert item["amount"] == "10.00"
    assert item["amount_hidden"] is False


def test_admin_refund_list_masks_transaction_amount() -> None:
    client = _request_client(is_admin=True)
    response = client.get("/requests")
    assert response.status_code == 200
    detail = response.json()["data"]["items"][0]["refund_detail"]
    assert detail["transaction_amount"] is None
    assert detail["transaction_amount_hidden"] is True


def test_support_refund_list_shows_transaction_amount() -> None:
    client = _request_client(is_admin=False)
    response = client.get("/requests")
    assert response.status_code == 200
    detail = response.json()["data"]["items"][0]["refund_detail"]
    assert detail["transaction_amount"] == "25.50"
    assert detail["transaction_amount_hidden"] is False
