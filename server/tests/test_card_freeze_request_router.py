"""Card-freeze request routes: create, approve (freezes the card), decline, list.

Uses a fake service via dependency override — the same no-DB pattern as
``test_request_router.py`` — so these exercise the route wiring, response shape,
and error mapping without touching Postgres.
"""

from datetime import datetime, timezone
import os

from fastapi.testclient import TestClient

from routes.dependencies import get_current_user_id, require_staff
from routes.request.request import get_request_service
from services.request.request import (
    CardAlreadyFrozenError,
    FreezeRequestAlreadyPendingError,
    RequestNotFoundError,
    RequestNotPendingError,
    RequestStatusNotFoundError,
)

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from main import create_app  # noqa: E402

_PENDING, _APPROVED, _DECLINED = 1, 2, 3
_FREEZE_TYPE_ID = 5


class _FreezeDetail:
    def __init__(self, request_id: int, card_id: int) -> None:
        self.request_id = request_id
        self.card_id = card_id

        class _Card:
            last_four = "4242"
            cardholder_name = "Jane Doe"

        self.card = _Card()


class _FreezeRow:
    def __init__(self, request_id: int, status_id: int, card_id: int = 7) -> None:
        now = datetime.now(timezone.utc)
        self.request_id = request_id
        self.request_type_id = _FREEZE_TYPE_ID
        self.request_status_id = status_id
        self.requester_user_id = 10
        self.requester = None
        self.target_user_id = None
        self.note = None
        self.created_at = now
        self.resolved_at = None if status_id == _PENDING else now
        self.refund_detail = None
        self.card_freeze_detail = _FreezeDetail(request_id, card_id)


class FakeRequestService:
    def __init__(self) -> None:
        self.create_error = None
        self.approve_error = None
        self.decline_error = None
        self._rows = [
            _FreezeRow(1, _PENDING),
            _FreezeRow(2, _APPROVED),
            _FreezeRow(3, _DECLINED),
        ]

    def request_card_freeze(self, *, card_id, note, user_id):
        if self.create_error is not None:
            raise self.create_error
        return _FreezeRow(99, _PENDING, card_id=card_id)

    def approve_card_freeze(self, *, request_id):
        if self.approve_error is not None:
            raise self.approve_error
        return _FreezeRow(request_id, _APPROVED)

    def decline_card_freeze(self, *, request_id):
        if self.decline_error is not None:
            raise self.decline_error
        return _FreezeRow(request_id, _DECLINED)

    def list_freezes(self, *, limit, offset, status_id=None):
        if status_id is not None and status_id not in {_PENDING, _APPROVED, _DECLINED}:
            raise RequestStatusNotFoundError()
        rows = self._rows
        if status_id is not None:
            rows = [r for r in rows if r.request_status_id == status_id]
        return rows[offset : offset + limit], len(rows)


def _build_client() -> tuple[TestClient, FakeRequestService]:
    app = create_app()
    fake_service = FakeRequestService()
    app.dependency_overrides[get_request_service] = lambda: fake_service
    app.dependency_overrides[require_staff] = lambda: 1
    app.dependency_overrides[get_current_user_id] = lambda: 10
    return TestClient(app), fake_service


def test_create_freeze_request_returns_201_with_card_detail() -> None:
    client, _ = _build_client()
    response = client.post("/requests/card-freeze", json={"card_id": 7})
    assert response.status_code == 201
    detail = response.json()["data"]["card_freeze_detail"]
    assert detail["card_id"] == 7
    assert detail["card_last_four"] == "4242"


def test_create_freeze_conflicts_when_already_frozen() -> None:
    client, fake = _build_client()
    fake.create_error = CardAlreadyFrozenError()
    response = client.post("/requests/card-freeze", json={"card_id": 7})
    assert response.status_code == 409


def test_create_freeze_conflicts_when_pending_exists() -> None:
    client, fake = _build_client()
    fake.create_error = FreezeRequestAlreadyPendingError()
    response = client.post("/requests/card-freeze", json={"card_id": 7})
    assert response.status_code == 409


def test_approve_freeze_returns_approved_status() -> None:
    client, _ = _build_client()
    response = client.post("/requests/2/approve-freeze")
    assert response.status_code == 200
    assert response.json()["data"]["request_status_id"] == _APPROVED


def test_approve_freeze_already_resolved_returns_409() -> None:
    client, fake = _build_client()
    fake.approve_error = RequestNotPendingError("approved")
    response = client.post("/requests/2/approve-freeze")
    assert response.status_code == 409


def test_decline_freeze_missing_returns_404() -> None:
    client, fake = _build_client()
    fake.decline_error = RequestNotFoundError()
    response = client.post("/requests/999/decline-freeze")
    assert response.status_code == 404


def test_list_freezes_filters_by_status() -> None:
    client, _ = _build_client()
    response = client.get("/requests/freezes", params={"status_id": _PENDING})
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 1
    assert all(item["request_status_id"] == _PENDING for item in data["items"])
