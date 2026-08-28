"""API tests: the transactions PDF export forwards every active filter.

Regression cover for the export dropping card / date-range / free-text search:
a filtered export used to return rows the on-screen list had filtered out.
"""
from datetime import date
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from fastapi.testclient import TestClient  # noqa: E402

from main import create_app  # noqa: E402
from routes.dependencies import get_current_user_id  # noqa: E402
from routes.export.export import (  # noqa: E402
    get_transaction_service,
    get_user_repo,
)
from services.transaction.transaction import (  # noqa: E402
    CardNotFoundError,
    ForbiddenError,
)


class _CapturingTransactionService:
    """Records the kwargs the export route passes down — no database required."""

    def __init__(self, *, raises: Exception | None = None) -> None:
        self.last_list_for_user: dict | None = None
        self.last_labels: dict | None = None
        self._raises = raises

    def list_for_user(self, **kwargs):
        self.last_list_for_user = kwargs
        if self._raises is not None:
            raise self._raises
        return [], 0

    def get_applied_filter_labels(self, **kwargs):
        self.last_labels = kwargs
        return {"status": None, "type": None, "category": None, "card": None}


class _StubUserRepo:
    def get_by_id(self, user_id: int):
        return type(
            "U",
            (),
            {
                "user_id": user_id,
                "first_name": "Ada",
                "last_name": "Lovelace",
                "email": "ada@example.com",
            },
        )()


def _client(service: _CapturingTransactionService) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_transaction_service] = lambda: service
    app.dependency_overrides[get_user_repo] = lambda: _StubUserRepo()
    app.dependency_overrides[get_current_user_id] = lambda: 1
    return TestClient(app)


def test_export_forwards_every_active_filter() -> None:
    service = _CapturingTransactionService()
    response = _client(service).get(
        "/export/transactions.pdf",
        params={
            "status_id": 2,
            "transaction_type_id": 1,
            "category_id": 3,
            "card_id": 7,
            "from_date": "2026-06-01",
            "to_date": "2026-06-30",
            "q": "coffee",
            "sort": "oldest",
        },
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"

    passed = service.last_list_for_user
    assert passed is not None
    assert passed["status_id"] == 2
    assert passed["transaction_type_id"] == 1
    assert passed["category_id"] == 3
    assert passed["card_id"] == 7
    assert passed["from_date"] == date(2026, 6, 1)
    assert passed["to_date"] == date(2026, 6, 30)
    assert passed["search"] == "coffee"
    assert passed["sort"] == "oldest"
    # Owner scoping is the whole safety story for the export.
    assert passed["user_id"] == 1


def test_export_labels_include_the_card() -> None:
    """The PDF header resolves the card id to a name, so a filtered export
    says which card it covers."""
    service = _CapturingTransactionService()
    response = _client(service).get(
        "/export/transactions.pdf", params={"card_id": 7}
    )
    assert response.status_code == 200
    assert service.last_labels is not None
    assert service.last_labels["card_id"] == 7


def test_unfiltered_export_still_works() -> None:
    service = _CapturingTransactionService()
    response = _client(service).get("/export/transactions.pdf")
    assert response.status_code == 200
    passed = service.last_list_for_user
    assert passed is not None
    assert passed["card_id"] is None
    assert passed["from_date"] is None
    assert passed["to_date"] is None
    assert passed["search"] is None


def test_export_with_no_matching_rows_returns_a_pdf_not_an_error() -> None:
    """Filters matching nothing must produce a valid empty-state PDF."""
    service = _CapturingTransactionService()
    response = _client(service).get(
        "/export/transactions.pdf", params={"q": "no-such-transaction"}
    )
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")


def test_export_rejects_a_card_the_user_cannot_read() -> None:
    service = _CapturingTransactionService(raises=ForbiddenError())
    response = _client(service).get(
        "/export/transactions.pdf", params={"card_id": 999}
    )
    assert response.status_code == 403


def test_export_404s_on_an_unknown_card() -> None:
    service = _CapturingTransactionService(raises=CardNotFoundError())
    response = _client(service).get(
        "/export/transactions.pdf", params={"card_id": 999}
    )
    assert response.status_code == 404
