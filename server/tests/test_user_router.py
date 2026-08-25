from datetime import datetime, timezone
from decimal import Decimal
import os

from fastapi.testclient import TestClient

from routes.dependencies import require_admin, require_staff
from routes.user.user import get_auth_service, get_user_service
from services.user.user import (
    DuplicateEmailError,
    InvalidUserRoleError,
    InvalidUserStatusError,
    UserHasPendingTransactionError,
    UserNotFoundError,
)

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from main import create_app  # noqa: E402


class _UserRow:
    def __init__(
        self,
        user_id: int,
        *,
        email: str,
        first_name: str,
        last_name: str,
        status_id: int = 1,
        user_role_id: int = 1,
        address: str | None = None,
        deleted_at: datetime | None = None,
        last_login_at: datetime | None = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        self.user_id = user_id
        self.email = email
        self.first_name = first_name
        self.last_name = last_name
        self.password_hash = "hashed"
        self.address = address
        self.status_id = status_id
        self.user_role_id = user_role_id
        self.created_at = now
        self.modified_at = now
        self.deleted_at = deleted_at
        self.last_login_at = last_login_at


class FakeUserService:
    def __init__(self) -> None:
        self._rows: dict[int, _UserRow] = {
            1: _UserRow(1, email="john@example.com", first_name="John", last_name="Doe"),
            2: _UserRow(2, email="ana@example.com", first_name="Ana", last_name="Dev", status_id=2),
        }
        self._next_id = 3

    def list_users(
        self,
        *,
        q: str | None,
        email: str | None,
        status_id: int | None,
        user_role_id: int | None,
        include_deleted: bool,
        limit: int,
        offset: int,
    ) -> list[_UserRow]:
        rows = [self._rows[k] for k in sorted(self._rows)]
        if not include_deleted:
            rows = [r for r in rows if r.deleted_at is None]
        if email is not None:
            rows = [r for r in rows if r.email == email]
        if status_id is not None:
            rows = [r for r in rows if r.status_id == status_id]
        if user_role_id is not None:
            rows = [r for r in rows if r.user_role_id == user_role_id]
        return rows[offset : offset + limit]

    def total_spent_by_user(self, user_ids: list[int]) -> dict[int, Decimal]:
        return {uid: Decimal("10.00") for uid in user_ids if uid in self._rows}

    def get_user(self, user_id: int, *, include_deleted: bool) -> _UserRow:
        row = self._rows.get(user_id)
        if row is None or (row.deleted_at is not None and not include_deleted):
            raise UserNotFoundError()
        return row

    def create_user(self, payload) -> _UserRow:
        if payload.user_role_id == 999:
            raise InvalidUserRoleError()
        if payload.status_id == 999:
            raise InvalidUserStatusError()
        if any(r.email == str(payload.email) for r in self._rows.values()):
            raise DuplicateEmailError()
        row = _UserRow(
            self._next_id,
            email=str(payload.email),
            first_name=payload.first_name,
            last_name=payload.last_name,
            status_id=payload.status_id,
            user_role_id=payload.user_role_id,
            address=payload.address,
        )
        self._rows[row.user_id] = row
        self._next_id += 1
        return row

    def update_user(self, user_id: int, payload) -> _UserRow:
        row = self._rows.get(user_id)
        if row is None or row.deleted_at is not None:
            raise UserNotFoundError()
        if payload.user_role_id == 999:
            raise InvalidUserRoleError()
        if payload.status_id == 999:
            raise InvalidUserStatusError()
        if payload.email is not None:
            for other_id, other in self._rows.items():
                if other_id != user_id and other.email == str(payload.email):
                    raise DuplicateEmailError()
            row.email = str(payload.email)
        if payload.first_name is not None:
            row.first_name = payload.first_name
        if payload.last_name is not None:
            row.last_name = payload.last_name
        if payload.status_id is not None:
            row.status_id = payload.status_id
        if payload.user_role_id is not None:
            row.user_role_id = payload.user_role_id
        if payload.address is not None:
            row.address = payload.address
        row.modified_at = datetime.now(timezone.utc)
        return row

    def delete_user(self, user_id: int) -> None:
        row = self._rows.get(user_id)
        if row is None:
            raise UserNotFoundError()
        row.deleted_at = datetime.now(timezone.utc)


class FakeAuthService:
    """Covers only what the admin reset-password route calls."""

    def __init__(self) -> None:
        self.reset_calls: list[int] = []
        self.raises: str | None = None

    def send_password_reset_for_user(self, user_id: int) -> str:
        if self.raises is not None:
            raise ValueError(self.raises)
        self.reset_calls.append(user_id)
        return f"user{user_id}@example.com"


def _build_client() -> tuple[TestClient, FakeUserService]:
    app = create_app()
    fake_service = FakeUserService()
    app.dependency_overrides[get_user_service] = lambda: fake_service
    app.dependency_overrides[get_auth_service] = lambda: FakeAuthService()
    app.dependency_overrides[require_admin] = lambda: 1
    app.dependency_overrides[require_staff] = lambda: 1
    return TestClient(app), fake_service


def _build_client_with_auth(auth: "FakeAuthService") -> TestClient:
    app = create_app()
    app.dependency_overrides[get_user_service] = lambda: FakeUserService()
    app.dependency_overrides[get_auth_service] = lambda: auth
    app.dependency_overrides[require_admin] = lambda: 1
    app.dependency_overrides[require_staff] = lambda: 1
    return TestClient(app)


def test_list_users_returns_200() -> None:
    client, _ = _build_client()
    response = client.get("/users")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_user_returns_200() -> None:
    client, _ = _build_client()
    response = client.get("/users/1")
    assert response.status_code == 200
    assert response.json()["email"] == "john@example.com"


def test_get_missing_user_returns_404() -> None:
    client, _ = _build_client()
    response = client.get("/users/999")
    assert response.status_code == 404
    assert response.json()["message"] == "User not found"


def test_create_user_returns_201() -> None:
    client, _ = _build_client()
    response = client.post(
        "/users",
        json={
            "email": "new@example.com",
            "first_name": "New",
            "last_name": "User",
            "password": "password123",
            "status_id": 1,
            "user_role_id": 1,
        },
    )
    assert response.status_code == 201
    assert response.json()["email"] == "new@example.com"
    assert "password_hash" not in response.json()


def test_create_duplicate_email_returns_409() -> None:
    client, _ = _build_client()
    response = client.post(
        "/users",
        json={
            "email": "john@example.com",
            "first_name": "John",
            "last_name": "Dupe",
            "password": "password123",
            "status_id": 1,
            "user_role_id": 1,
        },
    )
    assert response.status_code == 409
    assert response.json()["message"] == "Email already exists"


def test_create_invalid_user_role_returns_400() -> None:
    client, _ = _build_client()
    response = client.post(
        "/users",
        json={
            "email": "role@example.com",
            "first_name": "Role",
            "last_name": "Fail",
            "password": "password123",
            "status_id": 1,
            "user_role_id": 999,
        },
    )
    assert response.status_code == 400
    assert response.json()["message"] == "Invalid user_role_id"


def test_create_invalid_status_returns_400() -> None:
    client, _ = _build_client()
    response = client.post(
        "/users",
        json={
            "email": "status@example.com",
            "first_name": "Status",
            "last_name": "Fail",
            "password": "password123",
            "status_id": 999,
            "user_role_id": 1,
        },
    )
    assert response.status_code == 400
    assert response.json()["message"] == "Invalid status_id"


def test_update_user_returns_200() -> None:
    client, _ = _build_client()
    response = client.patch("/users/1", json={"last_name": "Updated"})
    assert response.status_code == 200
    assert response.json()["last_name"] == "Updated"


def test_update_duplicate_email_returns_409() -> None:
    client, _ = _build_client()
    response = client.patch("/users/1", json={"email": "ana@example.com"})
    assert response.status_code == 409
    assert response.json()["message"] == "Email already exists"


def test_update_invalid_fk_returns_400() -> None:
    client, _ = _build_client()
    response = client.patch("/users/1", json={"status_id": 999})
    assert response.status_code == 400
    assert response.json()["message"] == "Invalid status_id"


def test_update_missing_user_returns_404() -> None:
    client, _ = _build_client()
    response = client.patch("/users/999", json={"first_name": "Ghost"})
    assert response.status_code == 404
    assert response.json()["message"] == "User not found"


def test_delete_user_soft_deletes_and_returns_204() -> None:
    client, fake_service = _build_client()
    response = client.delete("/users/1")
    assert response.status_code == 204
    assert fake_service._rows[1].deleted_at is not None


def test_delete_missing_user_returns_404() -> None:
    client, _ = _build_client()
    response = client.delete("/users/999")
    assert response.status_code == 404
    assert response.json()["message"] == "User not found"


def test_delete_user_with_pending_transaction_returns_409() -> None:
    client, fake_service = _build_client()

    def _raise(_user_id: int) -> None:
        raise UserHasPendingTransactionError()

    fake_service.delete_user = _raise  # type: ignore[assignment]
    response = client.delete("/users/1")
    assert response.status_code == 409
    assert "pending" in response.json()["message"].lower()
    # the user must NOT be soft-deleted when the guard trips
    assert fake_service._rows[1].deleted_at is None


def test_list_users_includes_last_login_and_total_spent() -> None:
    client, _ = _build_client()
    rows = client.get("/users").json()
    assert all("last_login_at" in row for row in rows)
    # Never signed in -> null, rendered as "Never" rather than a missing value.
    assert all(row["last_login_at"] is None for row in rows)
    assert all(row["total_spent"] == "10.00" for row in rows)


def test_admin_reset_password_triggers_the_reset_and_reports_the_address() -> None:
    auth = FakeAuthService()
    client = _build_client_with_auth(auth)

    response = client.post("/users/1/reset-password")

    assert response.status_code == 200
    assert auth.reset_calls == [1]
    assert "user1@example.com" in response.json()["message"]


def test_admin_reset_password_for_unknown_user_returns_404() -> None:
    auth = FakeAuthService()
    auth.raises = "USER_NOT_FOUND"
    response = _build_client_with_auth(auth).post("/users/999/reset-password")
    assert response.status_code == 404


def test_admin_reset_password_reports_mail_failure_as_502() -> None:
    auth = FakeAuthService()
    auth.raises = "MAIL_DELIVERY_FAILED"
    response = _build_client_with_auth(auth).post("/users/1/reset-password")
    assert response.status_code == 502


def test_admin_reset_password_requires_admin() -> None:
    """No require_admin override -- the real dependency must reject the call."""
    app = create_app()
    app.dependency_overrides[get_user_service] = lambda: FakeUserService()
    app.dependency_overrides[get_auth_service] = lambda: FakeAuthService()
    response = TestClient(app).post("/users/1/reset-password")
    assert response.status_code in (401, 403)
