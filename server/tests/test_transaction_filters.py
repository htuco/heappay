"""API tests: admin/consumer transaction list + stats accept filter query params."""
from datetime import date
from decimal import Decimal
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from fastapi.testclient import TestClient  # noqa: E402

from main import create_app  # noqa: E402
from routes.dependencies import (  # noqa: E402
    get_current_user_id,
    require_admin,
    require_staff,
)
from routes.transaction.transaction import get_transaction_service  # noqa: E402


class _CapturingTransactionService:
    """Records kwargs passed from routes — no database required."""

    def __init__(self) -> None:
        self.last_list_all: dict | None = None
        self.last_list_for_user: dict | None = None
        self.last_stats: dict | None = None

    def list_all(self, **kwargs):
        self.last_list_all = kwargs
        return [], 0

    def list_for_user(self, **kwargs):
        self.last_list_for_user = kwargs
        return [], 0

    def get_platform_stats(self, **kwargs):
        self.last_stats = kwargs
        return {
            "monthly": [],
            "by_status": {},
            "by_type": {},
            "total_count": 0,
            "completed_volume": Decimal("0"),
            "months": kwargs.get("months", 6),
        }


def _client(*, admin: bool = True) -> tuple[TestClient, _CapturingTransactionService]:
    service = _CapturingTransactionService()
    app = create_app()
    app.dependency_overrides[get_transaction_service] = lambda: service
    app.dependency_overrides[get_current_user_id] = lambda: 1
    if admin:
        app.dependency_overrides[require_admin] = lambda: 1
        app.dependency_overrides[require_staff] = lambda: 1
    return TestClient(app), service


def test_admin_list_all_forwards_date_status_type_segment_sort() -> None:
    client, service = _client()
    response = client.get(
        "/transactions/all",
        params={
            "status_id": 2,
            "transaction_type_id": 1,
            "from_date": "2026-06-01",
            "to_date": "2026-06-30",
            "user_role_name": "user",
            "sort": "amount_desc",
        },
    )
    assert response.status_code == 200
    assert service.last_list_all is not None
    assert service.last_list_all["status_id"] == 2
    assert service.last_list_all["transaction_type_id"] == 1
    assert service.last_list_all["from_date"] == date(2026, 6, 1)
    assert service.last_list_all["to_date"] == date(2026, 6, 30)
    assert service.last_list_all["user_role_name"] == "user"
    assert service.last_list_all["sort"] == "amount_desc"


def test_admin_stats_forwards_filters() -> None:
    client, service = _client()
    response = client.get(
        "/transactions/stats",
        params={
            "months": 3,
            "status_id": 1,
            "transaction_type_id": 2,
            "from_date": "2026-07-01",
            "to_date": "2026-07-06",
            "user_role_name": "admin",
        },
    )
    assert response.status_code == 200
    assert service.last_stats is not None
    assert service.last_stats["months"] == 3
    assert service.last_stats["status_id"] == 1
    assert service.last_stats["transaction_type_id"] == 2
    assert service.last_stats["from_date"] == date(2026, 7, 1)
    assert service.last_stats["to_date"] == date(2026, 7, 6)
    assert service.last_stats["user_role_name"] == "admin"


def test_consumer_list_forwards_status_type_date_sort() -> None:
    client, service = _client(admin=False)
    response = client.get(
        "/transactions",
        params={
            "status_id": 2,
            "transaction_type_id": 1,
            "from_date": "2026-06-15",
            "to_date": "2026-06-15",
            "sort": "oldest",
        },
    )
    assert response.status_code == 200
    assert service.last_list_for_user is not None
    assert service.last_list_for_user["status_id"] == 2
    assert service.last_list_for_user["transaction_type_id"] == 1
    assert service.last_list_for_user["from_date"] == date(2026, 6, 15)
    assert service.last_list_for_user["to_date"] == date(2026, 6, 15)
    assert service.last_list_for_user["sort"] == "oldest"


def test_invalid_user_role_name_rejected() -> None:
    client, _service = _client()
    response = client.get("/transactions/all", params={"user_role_name": "hacker"})
    assert response.status_code == 422
