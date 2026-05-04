from datetime import datetime, timezone
import os

from fastapi.testclient import TestClient

from routers.card_type import get_card_type_service
from services.card_type import CardTypeInUseError, DuplicateCardTypeError

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from main import create_app  # noqa: E402


class _Row:
    def __init__(self, card_type_id: int, type_name: str, vendor: str) -> None:
        self.card_type_id = card_type_id
        self.type_name = type_name
        self.vendor = vendor
        self.created_at = datetime.now(timezone.utc)


class FakeCardTypeService:
    def __init__(self) -> None:
        self._rows: dict[int, _Row] = {
            1: _Row(1, "debit", "visa"),
            2: _Row(2, "credit", "mastercard"),
        }
        self._next_id = 3
        self._in_use_ids: set[int] = set()

    def list_all(self) -> list[_Row]:
        return [self._rows[k] for k in sorted(self._rows.keys())]

    def get_by_id(self, card_type_id: int) -> _Row | None:
        return self._rows.get(card_type_id)

    def create(self, type_name: str, vendor: str) -> _Row:
        if any(r.type_name == type_name and r.vendor == vendor for r in self._rows.values()):
            raise DuplicateCardTypeError()
        row = _Row(self._next_id, type_name, vendor)
        self._rows[row.card_type_id] = row
        self._next_id += 1
        return row

    def update(
        self,
        card_type_id: int,
        *,
        type_name: str | None = None,
        vendor: str | None = None,
    ) -> _Row | None:
        row = self._rows.get(card_type_id)
        if row is None:
            return None
        next_type = type_name if type_name is not None else row.type_name
        next_vendor = vendor if vendor is not None else row.vendor
        for other_id, other in self._rows.items():
            if other_id != card_type_id and other.type_name == next_type and other.vendor == next_vendor:
                raise DuplicateCardTypeError()
        row.type_name = next_type
        row.vendor = next_vendor
        return row

    def delete(self, card_type_id: int) -> bool:
        if card_type_id not in self._rows:
            return False
        if card_type_id in self._in_use_ids:
            raise CardTypeInUseError()
        del self._rows[card_type_id]
        return True

    def mark_in_use(self, card_type_id: int) -> None:
        self._in_use_ids.add(card_type_id)


def _build_client() -> tuple[TestClient, FakeCardTypeService]:
    app = create_app()
    fake_service = FakeCardTypeService()
    app.dependency_overrides[get_card_type_service] = lambda: fake_service
    client = TestClient(app)
    return client, fake_service


def test_list_card_types_returns_200() -> None:
    client, _ = _build_client()
    response = client.get("/card-types")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_existing_card_type_returns_200() -> None:
    client, _ = _build_client()
    response = client.get("/card-types/1")
    assert response.status_code == 200
    assert response.json()["type_name"] == "debit"


def test_get_missing_card_type_returns_404() -> None:
    client, _ = _build_client()
    response = client.get("/card-types/999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Card type not found"


def test_create_card_type_returns_201() -> None:
    client, _ = _build_client()
    response = client.post("/card-types", json={"type_name": "debit", "vendor": "amex"})
    assert response.status_code == 201
    assert response.json()["vendor"] == "amex"


def test_create_duplicate_card_type_returns_409() -> None:
    client, _ = _build_client()
    response = client.post("/card-types", json={"type_name": "debit", "vendor": "visa"})
    assert response.status_code == 409
    assert response.json()["detail"] == "Card type/vendor combination already exists"


def test_patch_card_type_returns_200() -> None:
    client, _ = _build_client()
    response = client.patch("/card-types/1", json={"vendor": "amex"})
    assert response.status_code == 200
    assert response.json()["vendor"] == "amex"


def test_patch_missing_card_type_returns_404() -> None:
    client, _ = _build_client()
    response = client.patch("/card-types/999", json={"vendor": "amex"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Card type not found"


def test_patch_duplicate_combo_returns_409() -> None:
    client, _ = _build_client()
    response = client.patch("/card-types/1", json={"type_name": "credit", "vendor": "mastercard"})
    assert response.status_code == 409
    assert response.json()["detail"] == "Card type/vendor combination already exists"


def test_delete_unused_card_type_returns_204() -> None:
    client, _ = _build_client()
    response = client.delete("/card-types/2")
    assert response.status_code == 204


def test_delete_missing_card_type_returns_404() -> None:
    client, _ = _build_client()
    response = client.delete("/card-types/999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Card type not found"


def test_delete_in_use_card_type_returns_409() -> None:
    client, fake_service = _build_client()
    fake_service.mark_in_use(1)
    response = client.delete("/card-types/1")
    assert response.status_code == 409
    assert response.json()["detail"] == "Card type is in use and cannot be deleted"
