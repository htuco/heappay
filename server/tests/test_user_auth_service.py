from datetime import datetime, timedelta, timezone
import os
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")

from schemas.user.auth import (  # noqa: E402
    AppPinChangeRequest,
    AppPinDisableRequest,
    AppPinSetRequest,
    ChangePasswordRequest,
    PasswordResetConfirmRequest,
    RegisterRequest,
)
from schemas.user.biometric import (  # noqa: E402
    BiometricDisableRequest,
    BiometricRegistrationCompleteRequest,
)
from services.user.auth import UserAuthService  # noqa: E402
from utils.pwned_passwords import PASSWORD_PWNED_MESSAGE  # noqa: E402


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
        self.app_pin_hash = None
        self.app_pin_failed_attempts = 0
        self.app_pin_locked_until = None
        self.app_pin_set_at = None


class _AuthRepo:
    def __init__(self) -> None:
        self.user = _UserRow()
        self.challenges = {}
        self.credentials = []

    def get_user_by_id(self, user_id: int):
        if user_id == self.user.user_id:
            return self.user
        return None

    def get_user_by_email(self, email: str):
        if email == self.user.email:
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

    def create_user(self, register_data, hashed_password: str):
        self.user.email = str(register_data.email)
        self.user.password_hash = hashed_password
        return self.user

    def save_refresh_token(self, user_id: int, refresh_token: str) -> None:
        if user_id == self.user.user_id:
            self.user.refresh_token = refresh_token

    def get_role_name_for_user(self, _role_id: int) -> str:
        return "user"

    def get_password_reset_token(self, _token_hash: str):
        return None

    def mark_password_reset_tokens_used_for_user(self, _user_id: int) -> None:
        return None

    def update_app_pin(self, user_id: int, pin_hash: str) -> None:
        if user_id == self.user.user_id:
            self.user.app_pin_hash = pin_hash
            self.user.app_pin_failed_attempts = 0
            self.user.app_pin_locked_until = None
            self.user.app_pin_set_at = datetime.now(timezone.utc)

    def record_app_pin_failure(self, user_id: int, *, failed_attempts: int, locked_until):
        if user_id == self.user.user_id:
            self.user.app_pin_failed_attempts = failed_attempts
            self.user.app_pin_locked_until = locked_until

    def reset_app_pin_failures(self, user_id: int) -> None:
        if user_id == self.user.user_id:
            self.user.app_pin_failed_attempts = 0
            self.user.app_pin_locked_until = None

    def clear_app_pin(self, user_id: int) -> None:
        if user_id == self.user.user_id:
            self.user.app_pin_hash = None
            self.user.app_pin_failed_attempts = 0
            self.user.app_pin_locked_until = None
            self.user.app_pin_set_at = None

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
            credential_row_id=len(self.credentials) + 1,
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

    def get_biometric_credential(self, user_id: int, credential_id: str):
        for row in self.credentials:
            if row.user_id == user_id and row.credential_id == credential_id:
                return row
        return None

    def delete_biometric_credentials(self, user_id: int):
        before = len(self.credentials)
        self.credentials = [row for row in self.credentials if row.user_id != user_id]
        return before - len(self.credentials)

    def create_biometric_authentication_challenge(
        self,
        *,
        user_id,
        transaction_id,
        challenge,
        expires_at,
    ):
        row = SimpleNamespace(
            challenge_id=len(self.challenges) + 1,
            user_id=user_id,
            transaction_id=transaction_id,
            challenge=challenge,
            expires_at=expires_at,
            used_at=None,
        )
        self.challenges[row.challenge_id] = row
        return row

    def get_biometric_authentication_challenge(self, *, user_id, transaction_id, challenge_id):
        row = self.challenges.get(challenge_id)
        if row and row.user_id == user_id and row.transaction_id == transaction_id:
            return row
        return None

    def mark_biometric_authentication_challenge_used(self, challenge_id):
        self.challenges[challenge_id].used_at = datetime.now(timezone.utc)

    def update_biometric_credential_usage(self, *, credential_row_id, sign_count):
        for row in self.credentials:
            if row.credential_row_id == credential_row_id:
                row.sign_count = sign_count
                row.last_used_at = datetime.now(timezone.utc)


def test_change_password_invalidates_existing_refresh_token() -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    payload = ChangePasswordRequest(
        current_password="OldPassword123!",
        new_password="NewPassword123!",
        confirm_password="NewPassword123!",
    )

    with (
        patch.object(
            service,
            "verify_password",
            side_effect=lambda plain, _hashed: plain == payload.current_password,
        ),
        patch.object(service, "hash_password", return_value="new-hash"),
        patch.object(service, "verify_refresh_token", return_value=repo.user.user_id),
        patch.object(service, "_validate_not_pwned", return_value=None),
    ):
        service.change_password(repo.user.user_id, payload)

        assert repo.user.password_hash == "new-hash"
        assert repo.user.refresh_token is None
        assert service.refresh("old.refresh.token") is None


def test_register_rejects_pwned_password() -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    payload = RegisterRequest(
        email="new@example.com",
        first_name="Test",
        last_name="User",
        password="StrongPass1!",
        hcaptcha_token=None,
    )
    with patch.object(service, "_validate_not_pwned", side_effect=ValueError(PASSWORD_PWNED_MESSAGE)):
        try:
            service.register(payload)
        except ValueError as exc:
            assert str(exc) == PASSWORD_PWNED_MESSAGE
        else:  # pragma: no cover
            raise AssertionError("Expected breached password to be rejected")


def test_change_password_rejects_same_as_current_password() -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    payload = ChangePasswordRequest(
        current_password="SamePassword1!",
        new_password="SamePassword1!",
        confirm_password="SamePassword1!",
    )
    with patch.object(service, "verify_password", return_value=True):
        try:
            service.change_password(repo.user.user_id, payload)
        except ValueError as exc:
            assert str(exc) == "SAME_AS_CURRENT_PASSWORD"
        else:  # pragma: no cover
            raise AssertionError("Expected same-as-current password to be rejected")


def test_change_password_rejects_pwned_password() -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    payload = ChangePasswordRequest(
        current_password="OldPassword123!",
        new_password="StrongPass1!",
        confirm_password="StrongPass1!",
    )
    with (
        patch.object(
            service,
            "verify_password",
            side_effect=lambda plain, _hashed: plain == payload.current_password,
        ),
        patch.object(service, "_validate_not_pwned", side_effect=ValueError(PASSWORD_PWNED_MESSAGE)),
    ):
        try:
            service.change_password(repo.user.user_id, payload)
        except ValueError as exc:
            assert str(exc) == PASSWORD_PWNED_MESSAGE
        else:  # pragma: no cover
            raise AssertionError("Expected pwned password to be rejected")


def test_confirm_password_reset_rejects_same_as_current_password() -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    token_row = SimpleNamespace(
        user_id=repo.user.user_id,
        used_at=None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    payload = PasswordResetConfirmRequest(
        token="a" * 32,
        new_password="StrongPass1!",
        confirm_password="StrongPass1!",
    )

    with patch.object(repo, "get_password_reset_token", return_value=token_row), patch.object(
        service, "verify_password", return_value=True
    ):
        try:
            service.confirm_password_reset(payload)
        except ValueError as exc:
            assert str(exc) == "SAME_AS_CURRENT_PASSWORD"
        else:  # pragma: no cover
            raise AssertionError("Expected same-as-current password to be rejected")


def test_confirm_password_reset_rejects_pwned_password() -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    token_row = SimpleNamespace(
        user_id=repo.user.user_id,
        used_at=None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    payload = PasswordResetConfirmRequest(
        token="a" * 32,
        new_password="StrongPass1!",
        confirm_password="StrongPass1!",
    )

    with (
        patch.object(repo, "get_password_reset_token", return_value=token_row),
        patch.object(service, "verify_password", return_value=False),
        patch.object(service, "_validate_not_pwned", side_effect=ValueError(PASSWORD_PWNED_MESSAGE)),
    ):
        try:
            service.confirm_password_reset(payload)
        except ValueError as exc:
            assert str(exc) == PASSWORD_PWNED_MESSAGE
        else:  # pragma: no cover
            raise AssertionError("Expected pwned password to be rejected")


def test_set_app_pin_requires_current_password() -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    payload = AppPinSetRequest(
        current_password="WrongPassword123!",
        pin="1234",
        confirm_pin="1234",
    )

    with patch.object(service, "verify_password", return_value=False):
        try:
            service.set_app_pin(repo.user.user_id, payload)
        except ValueError as exc:
            assert str(exc) == "WRONG_CURRENT_PASSWORD"
        else:  # pragma: no cover
            raise AssertionError("Expected app PIN setup to require the account password")


def test_set_app_pin_hashes_and_enables_pin() -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    payload = AppPinSetRequest(
        current_password="OldPassword123!",
        pin="1234",
        confirm_pin="1234",
    )

    with (
        patch.object(service, "verify_password", return_value=True),
        patch.object(service, "hash_app_pin", return_value="pin-hash"),
    ):
        status = service.set_app_pin(repo.user.user_id, payload)

    assert status.enabled is True
    assert status.locked is False
    assert repo.user.app_pin_hash == "pin-hash"
    assert repo.user.app_pin_failed_attempts == 0


def test_change_app_pin_verifies_current_pin() -> None:
    repo = _AuthRepo()
    repo.user.app_pin_hash = "old-pin-hash"
    service = UserAuthService(repo)
    payload = AppPinChangeRequest(
        current_pin="1234",
        new_pin="4321",
        confirm_pin="4321",
    )

    with (
        patch.object(service, "verify_app_pin") as verify_app_pin,
        patch.object(service, "hash_app_pin", return_value="new-pin-hash"),
    ):
        status = service.change_app_pin(repo.user.user_id, payload)

    verify_app_pin.assert_called_once_with(repo.user.user_id, "1234")
    assert status.enabled is True
    assert repo.user.app_pin_hash == "new-pin-hash"


def test_disable_app_pin_verifies_current_pin_then_clears_pin() -> None:
    repo = _AuthRepo()
    repo.user.app_pin_hash = "old-pin-hash"
    repo.user.app_pin_failed_attempts = 2
    service = UserAuthService(repo)
    payload = AppPinDisableRequest(current_pin="1234")

    with patch.object(service, "verify_app_pin") as verify_app_pin:
        status = service.disable_app_pin(repo.user.user_id, payload)

    verify_app_pin.assert_called_once_with(repo.user.user_id, "1234")
    assert status.enabled is False
    assert repo.user.app_pin_hash is None
    assert repo.user.app_pin_failed_attempts == 0


def test_verify_app_pin_locks_after_failed_attempts() -> None:
    repo = _AuthRepo()
    repo.user.app_pin_hash = "pin-hash"
    service = UserAuthService(repo)

    with patch.object(service, "verify_app_pin_hash", return_value=False):
        for _ in range(service.settings.app_pin_max_failed_attempts - 1):
            try:
                service.verify_app_pin(repo.user.user_id, "0000")
            except ValueError as exc:
                assert str(exc) == "INVALID_APP_PIN"
            else:  # pragma: no cover
                raise AssertionError("Expected invalid PIN to fail")

        try:
            service.verify_app_pin(repo.user.user_id, "0000")
        except ValueError as exc:
            assert str(exc) == "APP_PIN_LOCKED"
        else:  # pragma: no cover
            raise AssertionError("Expected repeated failures to lock the PIN")

    assert repo.user.app_pin_failed_attempts == service.settings.app_pin_max_failed_attempts
    assert repo.user.app_pin_locked_until is not None


def test_verify_app_pin_resets_failures_on_success() -> None:
    repo = _AuthRepo()
    repo.user.app_pin_hash = "pin-hash"
    repo.user.app_pin_failed_attempts = 2
    service = UserAuthService(repo)

    with patch.object(service, "verify_app_pin_hash", return_value=True):
        service.verify_app_pin(repo.user.user_id, "1234")

    assert repo.user.app_pin_failed_attempts == 0
    assert repo.user.app_pin_locked_until is None


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


def test_disable_biometric_authentication_requires_verification_when_enrolled() -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    repo.create_biometric_credential(
        user_id=repo.user.user_id,
        credential_id="Y3JlZGVudGlhbC1pZA",
        public_key=b"public-key",
        sign_count=0,
        aaguid=None,
        device_type="single_device",
        backed_up=False,
    )

    try:
        service.disable_biometric_authentication(repo.user.user_id)
    except ValueError as exc:
        assert str(exc) == "BIOMETRIC_VERIFICATION_REQUIRED"
    else:  # pragma: no cover
        raise AssertionError("Expected biometric disable to require verification")


def test_begin_biometric_disable_creates_account_challenge(monkeypatch) -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    repo.create_biometric_credential(
        user_id=repo.user.user_id,
        credential_id="Y3JlZGVudGlhbC1pZA",
        public_key=b"public-key",
        sign_count=0,
        aaguid=None,
        device_type="single_device",
        backed_up=False,
    )
    monkeypatch.setattr(
        "services.user.auth.generate_authentication_options",
        lambda **_: SimpleNamespace(challenge=b"challenge-bytes"),
    )
    monkeypatch.setattr(
        "services.user.auth.options_to_json",
        lambda _: '{"challenge":"challenge-bytes","allowCredentials":[]}',
    )

    response = service.begin_biometric_disable(repo.user.user_id)

    assert response.challenge_id == 1
    assert response.public_key["challenge"] == "challenge-bytes"
    assert repo.challenges[1].transaction_id is None


def test_complete_biometric_disable_verifies_then_removes_credentials(monkeypatch) -> None:
    repo = _AuthRepo()
    service = UserAuthService(repo)
    credential = repo.create_biometric_credential(
        user_id=repo.user.user_id,
        credential_id="Y3JlZGVudGlhbC1pZA",
        public_key=b"public-key",
        sign_count=0,
        aaguid=None,
        device_type="single_device",
        backed_up=False,
    )
    challenge = repo.create_biometric_authentication_challenge(
        user_id=repo.user.user_id,
        transaction_id=None,
        challenge="Y2hhbGxlbmdlLWJ5dGVz",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    monkeypatch.setattr(
        "services.user.auth.verify_authentication_response",
        lambda **_: SimpleNamespace(new_sign_count=2),
    )

    response = service.complete_biometric_disable(
        repo.user.user_id,
        BiometricDisableRequest(
            challenge_id=challenge.challenge_id,
            credential={"id": credential.credential_id, "rawId": credential.credential_id},
        ),
    )

    assert response.enabled is False
    assert response.credential_count == 0
    assert repo.credentials == []
