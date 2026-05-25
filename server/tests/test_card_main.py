from datetime import date, datetime, timezone
from decimal import Decimal
import os

from fastapi.testclient import TestClient

from routes.card.card import get_card_service
from routes.dependencies import UserContext, get_user_context
from services.card.card import CardDoesNotBelongToUserError, CardNotFoundError

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from main import create_app  # noqa: E402


class _CardRow:
    def __init__(
        self,
        card_id: int,
        user_id: int,
        *,
        is_main: bool = False,
        deleted_at: datetime | None = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        self.card_id = card_id
        self.user_id = user_id
        self.status_id = 1
        self.card_type_id = 1
        self.last_four = "1234"
        self.masked_card_number = "************1234"
        self.expires_at = date(2030, 12, 31)
        self.balance = Decimal("100.00")
        self.cardholder_name = "Test User"
        self.created_at = now
        self.deleted_at = deleted_at
        self.is_main = is_main


class FakeCardService:
    def __init__(self) -> None:
        self._rows: dict[int, _CardRow] = {
            1: _CardRow(1, user_id=10, is_main=True),
            2: _CardRow(2, user_id=10, is_main=False),
            3: _CardRow(3, user_id=99, is_main=True),
        }

    def get_by_id(self, card_id: int) -> _CardRow | None:
        row = self._rows.get(card_id)
        if row is None or row.deleted_at is not None:
            return None
        return row

    def get_by_id_including_deleted(self, card_id: int) -> _CardRow | None:
        return self._rows.get(card_id)

    def get_main_card(self, user_id: int) -> _CardRow | None:
        return next(
            (r for r in self._rows.values() if r.user_id == user_id and r.is_main and r.deleted_at is None),
            None,
        )

    def set_main_card(self, user_id: int, card_id: int) -> _CardRow:
        card = self._rows.get(card_id)
        if card is None or card.deleted_at is not None:
            raise CardNotFoundError()
        if card.user_id != user_id:
            raise CardDoesNotBelongToUserError()
        for row in self._rows.values():
            if row.user_id == user_id:
                row.is_main = row.card_id == card_id
        return card

    def list_all(self, **_kwargs) -> list[_CardRow]:
        return list(self._rows.values())

    def pending_card_ids_for_user(self, user_id: int) -> set[int]:
        return set()

    def create(self, payload):
        raise NotImplementedError

    def patch(self, card_id, payload):
        raise NotImplementedError

    def delete(self, card_id: int) -> None:
        pass

    def restore(self, card_id: int) -> _CardRow:
        raise NotImplementedError

    def lookup_by_card_number(self, card_numb: str):
        return None


def _build_client(user_id: int = 10, is_admin: bool = False) -> tuple[TestClient, FakeCardService]:
    app = create_app()
    fake_service = FakeCardService()
    ctx = UserContext(user_id=user_id, is_admin=is_admin)
    app.dependency_overrides[get_user_context] = lambda: ctx
    app.dependency_overrides[get_card_service] = lambda: fake_service
    client = TestClient(app)
    return client, fake_service


# ─── GET /cards/main ──────────────────────────────────────────────────────────

def test_get_main_card_returns_own_main_card() -> None:
    client, _ = _build_client(user_id=10)
    response = client.get("/cards/main")
    assert response.status_code == 200
    body = response.json()
    assert body["card_id"] == 1
    assert body["is_main"] is True


def test_get_main_card_returns_404_when_none_set() -> None:
    client, fake = _build_client(user_id=10)
    fake._rows[1].is_main = False
    response = client.get("/cards/main")
    assert response.status_code == 404
    assert "main" in response.json()["message"].lower()


def test_get_main_card_admin_can_query_other_user() -> None:
    client, _ = _build_client(user_id=1, is_admin=True)
    response = client.get("/cards/main", params={"user_id": 10})
    assert response.status_code == 200
    assert response.json()["card_id"] == 1


def test_get_main_card_non_admin_cannot_query_other_user() -> None:
    client, _ = _build_client(user_id=10)
    response = client.get("/cards/main", params={"user_id": 99})
    assert response.status_code == 403


# ─── PATCH /cards/{id}/set-main ───────────────────────────────────────────────

def test_set_main_card_returns_200_and_is_main_true() -> None:
    client, _ = _build_client(user_id=10)
    response = client.patch("/cards/2/set-main")
    assert response.status_code == 200
    assert response.json()["is_main"] is True


def test_set_main_card_returns_404_for_unknown_card() -> None:
    client, _ = _build_client(user_id=10)
    response = client.patch("/cards/999/set-main")
    assert response.status_code == 404


def test_set_main_card_returns_403_for_another_users_card() -> None:
    client, _ = _build_client(user_id=10)
    response = client.patch("/cards/3/set-main")
    assert response.status_code == 403


def test_set_main_card_admin_can_set_for_any_user() -> None:
    client, _ = _build_client(user_id=1, is_admin=True)
    response = client.patch("/cards/2/set-main")
    assert response.status_code == 200


# ─── is_main field in card responses ─────────────────────────────────────────

def test_list_cards_includes_is_main_field() -> None:
    client, _ = _build_client(user_id=10)
    response = client.get("/cards")
    assert response.status_code == 200
    cards = response.json()
    assert any(c["is_main"] is True for c in cards)
    assert all("is_main" in c for c in cards)
