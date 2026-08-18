"""Tests for payment categorisation: the category lookup route, the category_id
filter on list endpoints, category on create/patch, and the spending-by-category
breakdown. Follows the repo's fake-service + dependency-override test style; no DB.
"""
from datetime import datetime, timezone
from decimal import Decimal
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from fastapi.testclient import TestClient  # noqa: E402

from main import create_app  # noqa: E402
from routes.dependencies import get_current_user_id  # noqa: E402
from routes.transaction.transaction import get_transaction_service  # noqa: E402
from routes.transaction.transaction_category import get_repo as get_category_repo  # noqa: E402
from services.transaction.transaction import (  # noqa: E402
    ForbiddenError,
    TransactionCategoryNotFoundError,
)

_NOW = datetime.now(timezone.utc)

_SEEDED = [
    "groceries",
    "food_dining",
    "transport",
    "utilities",
    "housing",
    "shopping",
    "entertainment",
    "health",
    "subscriptions",
    "transfer",
    "income",
    "fees",
    "other",
]


# --------------------------------------------------------------------------- #
# Fakes
# --------------------------------------------------------------------------- #
class _FakeCategory:
    def __init__(self, category_id: int, name: str) -> None:
        self.transaction_category_id = category_id
        self.name = name
        self.created_at = _NOW


class FakeCategoryRepository:
    def __init__(self) -> None:
        self._rows = {
            i + 1: _FakeCategory(i + 1, name) for i, name in enumerate(_SEEDED)
        }

    def list_all(self):
        return list(self._rows.values())

    def get_by_id(self, category_id: int):
        return self._rows.get(category_id)


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
    def __init__(self, transaction_id: int, category_id: int | None = None) -> None:
        self.transaction_id = transaction_id
        self.sender_card_id = 1
        self.recipient_card_id = 2
        self.transaction_type_id = 1
        self.status_id = 1
        self.category_id = category_id
        self.amount = Decimal("10.00")
        self.note = None
        self.idempotency_key = None
        self.created_at = _NOW
        self.processing_eligible_at = _NOW
        self.sender_card = _FakeCard(1)
        self.recipient_card = _FakeCard(2)
        self.refund_detail = None


class FakeTransactionService:
    """Records calls so tests can assert param plumbing, and lets a test inject
    behaviour (raise, return)."""

    def __init__(self) -> None:
        self.list_for_user_kwargs = None
        self.create_payload = None
        self.patch_payload = None
        self.category_not_found_on_create = False
        self.category_not_found_on_patch = False
        self.forbidden_on_patch = False
        self.breakdown = [
            {"category_id": 1, "name": "groceries", "total": Decimal("80.00"), "count": 4},
            {"category_id": None, "name": None, "total": Decimal("20.00"), "count": 1},
        ]
        self.timeseries_range = None
        self.timeseries = {
            "range": "90d",
            "periods": ["2026-05", "2026-06", "2026-07"],
            "series": [
                {
                    "category_id": 1,
                    "name": "groceries",
                    "total": Decimal("80.00"),
                    "points": [Decimal("30.00"), Decimal("20.00"), Decimal("30.00")],
                },
                {
                    "category_id": None,
                    "name": "Uncategorised",
                    "total": Decimal("20.00"),
                    "points": [Decimal("0.00"), Decimal("20.00"), Decimal("0.00")],
                },
            ],
        }

    def list_for_user(self, **kwargs):
        self.list_for_user_kwargs = kwargs
        return [_FakeTransaction(1, category_id=kwargs.get("category_id"))], 1

    def create(self, payload, *, user_id):
        self.create_payload = payload
        if self.category_not_found_on_create:
            raise TransactionCategoryNotFoundError()
        return _FakeTransaction(42, category_id=payload.category_id), True

    def patch(self, transaction_id, payload, *, user_id):
        self.patch_payload = payload
        if self.forbidden_on_patch:
            raise ForbiddenError()
        if self.category_not_found_on_patch:
            raise TransactionCategoryNotFoundError()
        return _FakeTransaction(transaction_id, category_id=payload.category_id)

    def get_category_breakdown_for_user(self, *, user_id, months):
        return self.breakdown

    def get_category_timeseries_for_user(self, *, user_id, range_):
        self.timeseries_range = range_
        return self.timeseries


def _client(service: FakeTransactionService | None = None) -> TestClient:
    app = create_app()
    if service is not None:
        app.dependency_overrides[get_transaction_service] = lambda: service
    app.dependency_overrides[get_category_repo] = lambda: FakeCategoryRepository()
    app.dependency_overrides[get_current_user_id] = lambda: 10
    return TestClient(app)


# --------------------------------------------------------------------------- #
# Category list endpoint
# --------------------------------------------------------------------------- #
def test_list_categories_returns_seeded_set() -> None:
    client = _client()
    response = client.get("/transaction-categories")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == len(_SEEDED)
    assert {c["name"] for c in body} == set(_SEEDED)


def test_get_category_by_id_found() -> None:
    client = _client()
    response = client.get("/transaction-categories/1")
    assert response.status_code == 200
    assert response.json()["name"] == "groceries"


def test_get_category_by_id_missing_returns_404() -> None:
    client = _client()
    response = client.get("/transaction-categories/9999")
    assert response.status_code == 404


# --------------------------------------------------------------------------- #
# Create with category
# --------------------------------------------------------------------------- #
def _create_body(category_id=None) -> dict:
    body = {
        "recipient_card_id": 2,
        "transaction_type_id": 1,
        "amount": "10.00",
    }
    if category_id is not None:
        body["category_id"] = category_id
    return body


def test_create_with_valid_category_persists_it() -> None:
    service = FakeTransactionService()
    client = _client(service)
    response = client.post("/transactions", json=_create_body(category_id=3))
    assert response.status_code == 201
    assert service.create_payload.category_id == 3
    assert response.json()["data"]["category_id"] == 3


def test_create_with_null_category_succeeds() -> None:
    service = FakeTransactionService()
    client = _client(service)
    response = client.post("/transactions", json={**_create_body(), "category_id": None})
    assert response.status_code == 201
    assert service.create_payload.category_id is None
    assert response.json()["data"]["category_id"] is None


def test_create_with_omitted_category_succeeds() -> None:
    service = FakeTransactionService()
    client = _client(service)
    response = client.post("/transactions", json=_create_body())
    assert response.status_code == 201
    assert service.create_payload.category_id is None


def test_create_with_unknown_category_returns_404() -> None:
    service = FakeTransactionService()
    service.category_not_found_on_create = True
    client = _client(service)
    response = client.post("/transactions", json=_create_body(category_id=999))
    assert response.status_code == 404
    assert response.json()["message"] == "Transaction category not found."


# --------------------------------------------------------------------------- #
# Patch re-categorise
# --------------------------------------------------------------------------- #
def test_patch_sets_category() -> None:
    service = FakeTransactionService()
    client = _client(service)
    response = client.patch("/transactions/42", json={"category_id": 5})
    assert response.status_code == 200
    assert service.patch_payload.category_id == 5
    # A category-only patch carries no status change.
    assert "status_id" not in service.patch_payload.model_dump(exclude_unset=True)
    assert response.json()["data"]["category_id"] == 5


def test_patch_clears_category_with_null() -> None:
    service = FakeTransactionService()
    client = _client(service)
    response = client.patch("/transactions/42", json={"category_id": None})
    assert response.status_code == 200
    dumped = service.patch_payload.model_dump(exclude_unset=True)
    assert "category_id" in dumped and dumped["category_id"] is None


def test_patch_unknown_category_returns_404() -> None:
    service = FakeTransactionService()
    service.category_not_found_on_patch = True
    client = _client(service)
    response = client.patch("/transactions/42", json={"category_id": 999})
    assert response.status_code == 404
    assert response.json()["message"] == "Transaction category not found."


def test_patch_category_forbidden_for_non_owner() -> None:
    service = FakeTransactionService()
    service.forbidden_on_patch = True
    client = _client(service)
    response = client.patch("/transactions/42", json={"category_id": 5})
    assert response.status_code == 403


# --------------------------------------------------------------------------- #
# Filter by category
# --------------------------------------------------------------------------- #
def test_list_threads_category_filter_to_service() -> None:
    service = FakeTransactionService()
    client = _client(service)
    response = client.get("/transactions?category_id=3")
    assert response.status_code == 200
    assert service.list_for_user_kwargs["category_id"] == 3


def test_list_without_filter_passes_none() -> None:
    service = FakeTransactionService()
    client = _client(service)
    response = client.get("/transactions")
    assert response.status_code == 200
    assert service.list_for_user_kwargs["category_id"] is None


# --------------------------------------------------------------------------- #
# Spending-by-category breakdown
# --------------------------------------------------------------------------- #
def test_breakdown_returns_items_with_uncategorised_bucket() -> None:
    service = FakeTransactionService()
    client = _client(service)
    response = client.get("/transactions/summary/by-category?months=6")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["months"] == 6
    names = [i["name"] for i in data["items"]]
    # The null-category bucket is surfaced as "Uncategorised".
    assert "Uncategorised" in names
    assert "groceries" in names
    total = sum(Decimal(i["total"]) for i in data["items"])
    assert total == Decimal("100.00")


# --------------------------------------------------------------------------- #
# Spending-by-category time series (analytics trends)
# --------------------------------------------------------------------------- #
def test_timeseries_returns_periods_and_series() -> None:
    service = FakeTransactionService()
    client = _client(service)
    response = client.get("/transactions/summary/by-category/timeseries?range=90d")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["range"] == "90d"
    assert data["periods"] == ["2026-05", "2026-06", "2026-07"]
    # Each series' points line up with the periods axis.
    for series in data["series"]:
        assert len(series["points"]) == len(data["periods"])
    names = [s["name"] for s in data["series"]]
    assert "groceries" in names
    assert "Uncategorised" in names


def test_timeseries_defaults_range_and_validates() -> None:
    service = FakeTransactionService()
    client = _client(service)

    # Default when the param is omitted.
    assert client.get("/transactions/summary/by-category/timeseries").status_code == 200
    assert service.timeseries_range == "90d"

    # The '7d'|'30d'|'90d'|'1y' vocabulary is threaded through untouched.
    client.get("/transactions/summary/by-category/timeseries?range=1y")
    assert service.timeseries_range == "1y"

    # Anything outside the vocabulary is rejected by the route pattern.
    assert (
        client.get("/transactions/summary/by-category/timeseries?range=5d").status_code
        == 422
    )


def test_build_category_series_zero_fills_and_sorts() -> None:
    from services.transaction.transaction import build_category_series

    periods = ["2026-05", "2026-06", "2026-07"]
    rows = [
        # groceries spends only in May and July — June must zero-fill.
        {"period": "2026-05", "category_id": 1, "name": "groceries", "total": Decimal("30.00")},
        {"period": "2026-07", "category_id": 1, "name": "groceries", "total": Decimal("30.00")},
        # A bigger category to prove descending sort by total.
        {"period": "2026-06", "category_id": 2, "name": "housing", "total": Decimal("100.00")},
        # Null category surfaces as "Uncategorised".
        {"period": "2026-06", "category_id": None, "name": None, "total": Decimal("5.00")},
    ]
    series = build_category_series(rows, periods)

    # Sorted by total spend descending.
    assert [s["name"] for s in series] == ["housing", "groceries", "Uncategorised"]

    groceries = next(s for s in series if s["name"] == "groceries")
    assert groceries["points"] == [Decimal("30.00"), Decimal("0"), Decimal("30.00")]
    assert groceries["total"] == Decimal("60.00")

    uncategorised = next(s for s in series if s["category_id"] is None)
    assert uncategorised["name"] == "Uncategorised"
    assert uncategorised["points"] == [Decimal("0"), Decimal("5.00"), Decimal("0")]


def test_month_axis_spans_window_inclusive() -> None:
    from services.transaction.transaction import _month_axis

    # A ~90 day window spans at most 4 calendar months and is chronological.
    axis = _month_axis(90)
    assert axis == sorted(axis)
    assert 3 <= len(axis) <= 4
    # Each label is a well-formed "YYYY-MM".
    for label in axis:
        year, month = label.split("-")
        assert len(year) == 4 and 1 <= int(month) <= 12
