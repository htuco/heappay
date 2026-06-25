from datetime import datetime, timezone
import os
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from schemas.user.auth import ChangePasswordRequest  # noqa: E402
from services.user.auth import UserAuthService  # noqa: E402


class _UserRow:
    def __init__(self) -> None:
        self.user_id = 42
        self.email = "test@example.com"
        self.first_name = "Test"
        self.last_name = "User"
        self.password_hash = "old-hash"
        self.refresh_token = "old.refresh.token"
        self.created_at = datetime.now(timezone.utc)
        self.user_role_id = 2
        self.deleted_at = None


class _AuthRepo:
    def __init__(self) -> None:
        self.user = _UserRow()

    def get_user_by_id(self, user_id: int):
        if user_id == self.user.user_id:
            return self.user
        return None

    def get_user_by_refresh_token(self, refresh_token: str):
        if self.user.refresh_token == refresh_token:
            return self.user
        return None

    def update_password_and_clear_refresh_token(
        self,
        user_id: int,
        hashed_password: str,
    ) -> None:
        if user_id == self.user.user_id:
            self.user.password_hash = hashed_password
            self.user.refresh_token = None


def test_change_password_invalidates_existing_refresh_token() -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    payload = ChangePasswordRequest(
        current_password="OldPassword123!",
        new_password="NewPassword123!",
        confirm_password="NewPassword123!",
    )

    with (
        patch.object(service, "verify_password", return_value=True),
        patch.object(service, "hash_password", return_value="new-hash"),
        patch.object(service, "verify_refresh_token", return_value=repo.user.user_id),
    ):
        service.change_password(repo.user.user_id, payload)

        assert repo.user.password_hash == "new-hash"
        assert repo.user.refresh_token is None
        assert service.refresh("old.refresh.token") is None
