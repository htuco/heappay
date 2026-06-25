from datetime import datetime, timedelta, timezone
import os
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from schemas.user.auth import ChangePasswordRequest  # noqa: E402
from schemas.user.biometric import BiometricRegistrationCompleteRequest  # noqa: E402
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
        self.first_name = "Test"
        self.last_name = "User"


class _AuthRepo:
    def __init__(self) -> None:
        self.user = _UserRow()
        self.challenges = {}
        self.credentials = []

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

    def list_biometric_credentials(self, user_id: int):
        return [row for row in self.credentials if row.user_id == user_id]

    def create_biometric_registration_challenge(self, user_id, challenge, expires_at):
        row = SimpleNamespace(
            challenge_id=len(self.challenges) + 1,
            user_id=user_id,
            challenge=challenge,
            expires_at=expires_at,
            used_at=None,
        )
        self.challenges[row.challenge_id] = row
        return row

    def get_biometric_registration_challenge(self, user_id, challenge_id):
        row = self.challenges.get(challenge_id)
        if row and row.user_id == user_id:
            return row
        return None

    def mark_biometric_registration_challenge_used(self, challenge_id):
        self.challenges[challenge_id].used_at = datetime.now(timezone.utc)

    def create_biometric_credential(
        self,
        *,
        user_id,
        credential_id,
        public_key,
        sign_count,
        aaguid,
        device_type,
        backed_up,
    ):
        row = SimpleNamespace(
            user_id=user_id,
            credential_id=credential_id,
            public_key=public_key,
            sign_count=sign_count,
            aaguid=aaguid,
            device_type=device_type,
            backed_up=backed_up,
        )
        self.credentials.append(row)
        return row


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


def test_begin_biometric_registration_stores_challenge(monkeypatch) -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    options = SimpleNamespace(challenge=b"challenge-bytes")
    monkeypatch.setattr("services.user.auth.generate_registration_options", lambda **_: options)
    monkeypatch.setattr(
        "services.user.auth.options_to_json",
        lambda _: '{"challenge":"challenge-bytes"}',
    )

    response = service.begin_biometric_registration(repo.user.user_id)

    assert response.challenge_id == 1
    assert response.public_key["challenge"] == "challenge-bytes"
    assert repo.challenges[1].challenge == "Y2hhbGxlbmdlLWJ5dGVz"


def test_complete_biometric_registration_persists_credential(monkeypatch) -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    challenge = repo.create_biometric_registration_challenge(
        repo.user.user_id,
        "Y2hhbGxlbmdlLWJ5dGVz",
        datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    verified = SimpleNamespace(
        credential_id=b"credential-id",
        credential_public_key=b"public-key",
        sign_count=3,
        aaguid="aaguid",
        credential_device_type=SimpleNamespace(value="single_device"),
        credential_backed_up=False,
    )
    monkeypatch.setattr(
        "services.user.auth.verify_registration_response",
        lambda **_: verified,
    )

    response = service.complete_biometric_registration(
        repo.user.user_id,
        BiometricRegistrationCompleteRequest(
            challenge_id=challenge.challenge_id,
            credential={"id": "credential-id"},
        ),
    )

    assert response.credential_id == "Y3JlZGVudGlhbC1pZA"
    assert repo.credentials[0].public_key == b"public-key"
    assert repo.challenges[challenge.challenge_id].used_at is not None


def test_complete_biometric_registration_rejects_expired_challenge() -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    challenge = repo.create_biometric_registration_challenge(
        repo.user.user_id,
        "Y2hhbGxlbmdlLWJ5dGVz",
        datetime.now(timezone.utc).replace(year=2000),
    )

    try:
        service.complete_biometric_registration(
            repo.user.user_id,
            BiometricRegistrationCompleteRequest(
                challenge_id=challenge.challenge_id,
                credential={"id": "credential-id"},
            ),
        )
    except ValueError as exc:
        assert str(exc) == "INVALID_OR_EXPIRED_BIOMETRIC_CHALLENGE"
    else:  # pragma: no cover
        raise AssertionError("Expected expired biometric challenge to fail")
