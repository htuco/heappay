from datetime import datetime, timezone
import os

from fastapi.testclient import TestClient

from routes.dependencies import require_staff
from routes.request.request import get_request_service
from services.request.request import RequestStatusNotFoundError

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from main import create_app  # noqa: E402

# Seeded request_statuses ids (append-only lookup table).
_PENDING, _APPROVED, _DECLINED, _CANCELLED = 1, 2, 3, 4


class _RefundDetail:
    def __init__(self, request_id: int, transaction_id: int) -> None:
        self.request_id = request_id
        self.transaction_id = transaction_id
        self.transaction = None


class _RequestRow:
    def __init__(self, request_id: int, status_id: int) -> None:
        now = datetime.now(timezone.utc)
        self.request_id = request_id
        self.request_type_id = 1
        self.request_status_id = status_id
        self.requester_user_id = 10
        self.requester = None
        self.target_user_id = None
        self.note = None
        self.created_at = now
        self.resolved_at = None if status_id == _PENDING else now
        self.refund_detail = _RefundDetail(request_id, transaction_id=100 + request_id)


class FakeRequestService:
    def __init__(self) -> None:
        self._rows = [
            _RequestRow(1, _PENDING),
            _RequestRow(2, _PENDING),
            _RequestRow(3, _APPROVED),
            _RequestRow(4, _DECLINED),
        ]

    def list_refunds(self, *, limit, offset, status_id=None):
        if status_id is not None and status_id not in {_PENDING, _APPROVED, _DECLINED, _CANCELLED}:
            raise RequestStatusNotFoundError()
        rows = self._rows
        if status_id is not None:
            rows = [r for r in rows if r.request_status_id == status_id]
        return rows[offset : offset + limit], len(rows)

    def get_refund_stats(self):
        return {"pending": 2, "approved": 1, "declined": 1, "cancelled": 0, "total": 4}


def _build_client() -> tuple[TestClient, FakeRequestService]:
    app = create_app()
    fake_service = FakeRequestService()
    app.dependency_overrides[get_request_service] = lambda: fake_service
    app.dependency_overrides[require_staff] = lambda: 1
    return TestClient(app), fake_service


def test_request_stats_returns_counts_by_status() -> None:
    client, _ = _build_client()
    response = client.get("/requests/stats")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data == {"pending": 2, "approved": 1, "declined": 1, "cancelled": 0, "total": 4}


def test_list_refunds_returns_all_by_default() -> None:
    client, _ = _build_client()
    response = client.get("/requests")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 4
    assert len(data["items"]) == 4


def test_list_refunds_filters_by_status() -> None:
    client, _ = _build_client()
    response = client.get("/requests", params={"status_id": _PENDING})
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 2
    assert all(item["request_status_id"] == _PENDING for item in data["items"])


def test_list_refunds_unknown_status_returns_404() -> None:
    client, _ = _build_client()
    response = client.get("/requests", params={"status_id": 999})
    assert response.status_code == 404
    assert response.json()["message"] == "Request status not found."


def test_stats_route_not_shadowed_by_request_id_path() -> None:
    # /requests/stats must resolve to the stats handler, not a /{id} route.
    client, _ = _build_client()
    assert client.get("/requests/stats").status_code == 200
