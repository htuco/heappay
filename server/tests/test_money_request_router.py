from datetime import datetime, timezone
from decimal import Decimal
import os

from fastapi.testclient import TestClient

from routes.dependencies import require_verified_user
from routes.request.request import get_request_service
from services.request.request import (
    ForbiddenError,
    MoneyRequestAlreadyPendingError,
    RequestNotFoundError,
    RequestNotPendingError,
    RequesterNoCardError,
    SelfRequestError,
    TargetNotFoundError,
)
from services.transaction.transaction import InsufficientBalanceError

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from main import create_app  # noqa: E402

_PENDING, _APPROVED, _DECLINED = 1, 2, 3


class _MoneyDetail:
    def __init__(self, request_id: int, amount: Decimal) -> None:
        self.request_id = request_id
        self.amount = amount
        self.settled_transaction_id = None


class _User:
    def __init__(self, first_name: str, last_name: str) -> None:
        self.first_name = first_name
        self.last_name = last_name


class _RequestRow:
    def __init__(
        self,
        request_id: int,
        status_id: int,
        *,
        requester_user_id: int = 10,
        target_user_id: int = 20,
    ) -> None:
        now = datetime.now(timezone.utc)
        self.request_id = request_id
        self.request_type_id = 4
        self.request_type = type("T", (), {"name": "money_request"})()
        self.request_status_id = status_id
        self.requester_user_id = requester_user_id
        self.requester = _User("Ada", "Lovelace")
        self.target_user_id = target_user_id
        self.target = _User("Alan", "Turing")
        self.note = "lunch"
        self.created_at = now
        self.resolved_at = None if status_id == _PENDING else now
        self.refund_detail = None
        self.card_freeze_detail = None
        self.money_request_detail = _MoneyDetail(request_id, Decimal("12.50"))


class FakeMoneyRequestService:
    def __init__(self) -> None:
        self._incoming = [_RequestRow(1, _PENDING)]
        self.pay_calls = 0
        self.decline_calls = 0
        self.create_payload = None
        self.pay_error = None
        self.decline_error = None
        self.create_error = None

    def request_money(self, **kwargs):
        if self.create_error is not None:
            raise self.create_error
        self.create_payload = kwargs
        return _RequestRow(9, _PENDING, requester_user_id=kwargs["requester_user_id"],
                           target_user_id=kwargs["target_user_id"])

    def list_incoming_money_requests(self, *, user_id, limit, offset):
        rows = [r for r in self._incoming if r.target_user_id == user_id]
        return rows[offset : offset + limit], len(rows)

    def list_outgoing_money_requests(self, *, user_id, limit, offset):
        return [], 0

    def pay_money_request(self, **kwargs):
        self.pay_calls += 1
        if self.pay_error is not None:
            raise self.pay_error
        row = self._incoming[0]
        row.request_status_id = _APPROVED
        row.money_request_detail.settled_transaction_id = 500
        return row

    def decline_money_request(self, **kwargs):
        self.decline_calls += 1
        if self.decline_error is not None:
            raise self.decline_error
        row = self._incoming[0]
        row.request_status_id = _DECLINED
        return row


def _build_client(user_id: int = 20) -> tuple[TestClient, FakeMoneyRequestService]:
    app = create_app()
    fake_service = FakeMoneyRequestService()
    app.dependency_overrides[get_request_service] = lambda: fake_service
    app.dependency_overrides[require_verified_user] = lambda: user_id
    return TestClient(app), fake_service


def test_create_money_request_returns_201() -> None:
    client, fake = _build_client(user_id=10)
    response = client.post(
        "/requests/money",
        json={"target_user_id": 20, "amount": "12.50", "note": "lunch"},
    )
    assert response.status_code == 201
    assert fake.create_payload["target_user_id"] == 20
    data = response.json()["data"]
    assert data["money_request_detail"]["amount"] == "12.50"
    assert data["target_user_id"] == 20


def test_create_self_request_returns_400() -> None:
    client, fake = _build_client(user_id=10)
    fake.create_error = SelfRequestError()
    response = client.post(
        "/requests/money",
        json={"target_user_id": 10, "amount": "5.00"},
    )
    assert response.status_code == 400
    assert response.json()["message"] == "You cannot request money from yourself."


def test_create_missing_target_returns_404() -> None:
    client, fake = _build_client(user_id=10)
    fake.create_error = TargetNotFoundError()
    response = client.post(
        "/requests/money",
        json={"target_user_id": 99, "amount": "5.00"},
    )
    assert response.status_code == 404


def test_create_duplicate_pending_returns_409() -> None:
    client, fake = _build_client(user_id=10)
    fake.create_error = MoneyRequestAlreadyPendingError()
    response = client.post(
        "/requests/money",
        json={"target_user_id": 20, "amount": "5.00"},
    )
    assert response.status_code == 409


def test_list_incoming_returns_pending_for_caller() -> None:
    client, _ = _build_client(user_id=20)
    response = client.get("/requests/money/incoming")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["money_request_detail"]["amount"] == "12.50"
    assert data["items"][0]["money_request_detail"]["requester_name"] == "Ada Lovelace"


def test_incoming_route_not_shadowed_by_request_id_path() -> None:
    client, _ = _build_client(user_id=20)
    assert client.get("/requests/money/incoming").status_code == 200
    assert client.get("/requests/money/outgoing").status_code == 200


def test_pay_money_request_succeeds() -> None:
    client, fake = _build_client(user_id=20)
    response = client.post(
        "/requests/money/1/pay",
        json={"sender_card_id": 3},
    )
    assert response.status_code == 200
    assert fake.pay_calls == 1
    assert response.json()["data"]["money_request_detail"]["settled_transaction_id"] == 500


def test_pay_missing_request_returns_404() -> None:
    client, fake = _build_client(user_id=20)
    fake.pay_error = RequestNotFoundError()
    response = client.post("/requests/money/999/pay", json={"sender_card_id": 3})
    assert response.status_code == 404


def test_pay_by_non_target_returns_403() -> None:
    client, fake = _build_client(user_id=10)
    fake.pay_error = ForbiddenError()
    response = client.post("/requests/money/1/pay", json={"sender_card_id": 3})
    assert response.status_code == 403


def test_pay_already_resolved_returns_409() -> None:
    client, fake = _build_client(user_id=20)
    fake.pay_error = RequestNotPendingError("approved")
    response = client.post("/requests/money/1/pay", json={"sender_card_id": 3})
    assert response.status_code == 409


def test_pay_requester_no_card_returns_409() -> None:
    client, fake = _build_client(user_id=20)
    fake.pay_error = RequesterNoCardError()
    response = client.post("/requests/money/1/pay", json={"sender_card_id": 3})
    assert response.status_code == 409
    assert "no active card" in response.json()["message"]


def test_pay_insufficient_funds_returns_400() -> None:
    client, fake = _build_client(user_id=20)
    fake.pay_error = InsufficientBalanceError()
    response = client.post("/requests/money/1/pay", json={"sender_card_id": 3})
    assert response.status_code == 400
    assert fake.pay_calls == 1


def test_decline_money_request_succeeds() -> None:
    client, fake = _build_client(user_id=20)
    response = client.post("/requests/money/1/decline")
    assert response.status_code == 200
    assert fake.decline_calls == 1
    assert response.json()["message"] == "Money request declined."


def test_decline_by_non_target_returns_403() -> None:
    client, fake = _build_client(user_id=10)
    fake.decline_error = ForbiddenError()
    response = client.post("/requests/money/1/decline")
    assert response.status_code == 403
