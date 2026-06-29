from datetime import datetime, timedelta, timezone
import base64
import hashlib
import json
import secrets
from typing import Optional
from urllib.parse import urlencode

import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError
from sqlalchemy.exc import IntegrityError
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.exceptions import InvalidRegistrationResponse, WebAuthnException
from webauthn.helpers.structs import (
    AuthenticatorAttachment,
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from repositories.user.auth import UserAuthRepository
from services.storage.avatar_display_url import resolve_avatar_url_for_client
from schemas.user.biometric import (
    BiometricAuthenticationOptionsResponse,
    BiometricCredentialResponse,
    BiometricDisableRequest,
    BiometricRegistrationCompleteRequest,
    BiometricRegistrationOptionsResponse,
    BiometricStatusResponse,
)
from schemas.user.auth import (
    AcceptInvitationRequest,
    ChangePasswordRequest,
    DeactivateAccountRequest,
    LoginRequest,
    NotificationPreferencesUpdate,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    TokenResponse,
    TotpRequiredResponse,
    TotpSetupResponse,
    UserResponse,
)
from services.user.password_reset_mailer import PasswordResetMailer
from settings import get_settings
from utils.totp import (
    build_totp_uri,
    decrypt_secret,
    encrypt_secret,
    generate_totp_secret,
    verify_totp_code,
)


def decode_access_token_subject(token: str) -> int | None:
    """Decode a bearer token and return its `sub` user id if it is a valid access
    token, otherwise ``None``. Pure JWT verification — no DB lookup — so it can be
    reused outside a request/DB context (e.g. the rate-limiter key function)."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
    except InvalidTokenError:
        return None
    if payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    return int(user_id)


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _base64url_decode(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


class UserAuthService:
    def __init__(self, repo: UserAuthRepository) -> None:
        self.repo = repo
        self.settings = get_settings()
        self.password_reset_mailer = PasswordResetMailer(self.settings)

    def hash_password(self, password: str) -> str:
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
        return hashed.decode("utf-8")

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )

    def create_access_token(self, user_id: int) -> str:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=self.settings.access_token_expire_minutes
        )
        payload = {"sub": str(user_id), "exp": expire, "type": "access"}
        return jwt.encode(
            payload, self.settings.secret_key, algorithm=self.settings.algorithm
        )

    def create_refresh_token(self, user_id: int, expires_delta: Optional[timedelta] = None) -> str:
        if expires_delta is None:
            expires_delta = timedelta(days=7)
        expire = datetime.now(timezone.utc) + expires_delta
        payload = {"sub": str(user_id), "exp": expire, "type": "refresh"}
        return jwt.encode(
            payload, self.settings.secret_key, algorithm=self.settings.algorithm
        )

    def verify_access_token(self, token: str) -> Optional[int]:
        return decode_access_token_subject(token)

    def verify_refresh_token(self, token: str) -> Optional[int]:
        try:
            payload = jwt.decode(
                token, self.settings.secret_key, algorithms=[self.settings.algorithm]
            )
            if payload.get("type") != "refresh":
                return None
            user_id: str = payload.get("sub")
            if user_id is None:
                return None
            return int(user_id)
        except InvalidTokenError:
            return None

    def _hash_reset_token(self, token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def _build_password_reset_url(self, token: str) -> str:
        separator = "&" if "?" in self.settings.password_reset_url else "?"
        return f"{self.settings.password_reset_url}{separator}{urlencode({'token': token})}"

    def _is_expired(self, value: datetime) -> bool:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value <= datetime.now(timezone.utc)

    def resolve_active_user_id(self, access_token: str) -> int | None:
        """Valid access JWT + existing user + not soft-deleted (deactivated)."""
        user_id = self.verify_access_token(access_token)
        if user_id is None:
            return None
        user = self.repo.get_user_by_id(user_id)
        if user is None or user.deleted_at is not None:
            return None
        return user_id

    def _build_token_response(self, user_id: int, refresh_token: str) -> TokenResponse:
        user = self.repo.get_user_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        return self._build_token_response_for_user(user, refresh_token)

    def _build_token_response_for_user(
        self,
        user,
        refresh_token: str,
        access_token: str | None = None,
    ) -> TokenResponse:
        role_name = self.repo.get_role_name_for_user(user.user_role_id)
        raw_avatar = getattr(user, "avatar_url", None)
        user_response = UserResponse(
            id=user.user_id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            created_at=user.created_at,
            status_id=user.status_id,
            user_role_id=user.user_role_id,
            role_name=role_name,
            billing_reminders_enabled=user.billing_reminders_enabled,
            email_payment_sent_enabled=user.email_payment_sent_enabled,
            email_payment_received_enabled=user.email_payment_received_enabled,
            email_topup_enabled=user.email_topup_enabled,
            email_refund_status_enabled=user.email_refund_status_enabled,
            avatar_url=resolve_avatar_url_for_client(raw_avatar, self.settings),
            totp_enabled=user.totp_enabled,
        )
        return TokenResponse(
            access_token=access_token or self.create_access_token(user.user_id),
            refresh_token=refresh_token,
            token_type="bearer",
            user=user_response,
        )

    def register(self, register_data: RegisterRequest) -> TokenResponse:
        existing_user = self.repo.get_user_by_email(str(register_data.email))
        if existing_user:
            raise ValueError("EMAIL_NOT_AVAILABLE")

        hashed_password = self.hash_password(register_data.password)
        user = self.repo.create_user(register_data, hashed_password)
        refresh_token = self.create_refresh_token(user.user_id)
        self.repo.save_refresh_token(user.user_id, refresh_token)
        return self._build_token_response(user.user_id, refresh_token)

    def create_partial_token(self, user_id: int) -> str:
        """Short-lived token issued after correct password when 2FA is enabled.
        Can only be exchanged at /auth/totp/verify — not valid as an access token."""
        expire = datetime.now(timezone.utc) + timedelta(minutes=5)
        payload = {"sub": str(user_id), "exp": expire, "type": "totp_pending"}
        return jwt.encode(payload, self.settings.secret_key, algorithm=self.settings.algorithm)

    def verify_partial_token(self, token: str) -> int | None:
        """Returns user_id if the partial token is valid and unexpired, else None."""
        try:
            payload = jwt.decode(token, self.settings.secret_key, algorithms=[self.settings.algorithm])
            if payload.get("type") != "totp_pending":
                return None
            user_id = payload.get("sub")
            return int(user_id) if user_id else None
        except InvalidTokenError:
            return None

    def login(self, login_data: LoginRequest) -> TokenResponse | TotpRequiredResponse:
        user = self.repo.get_user_by_email(str(login_data.email))
        if not user or user.deleted_at is not None:
            raise ValueError("Invalid email or password")

        if not self.verify_password(login_data.password, user.password_hash):
            raise ValueError("Invalid email or password")

        if user.totp_enabled:
            partial_token = self.create_partial_token(user.user_id)
            return TotpRequiredResponse(partial_token=partial_token)

        refresh_token = self.create_refresh_token(user.user_id)
        self.repo.save_refresh_token(user.user_id, refresh_token)
        return self._build_token_response(user.user_id, refresh_token)

    def verify_totp_login(self, partial_token: str, code: str) -> TokenResponse:
        """Second step of 2FA login — validate partial token + TOTP code, issue real JWT."""
        user_id = self.verify_partial_token(partial_token)
        if user_id is None:
            raise ValueError("INVALID_OR_EXPIRED_TOKEN")

        user = self.repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None or not user.totp_enabled or not user.totp_secret:
            raise ValueError("INVALID_OR_EXPIRED_TOKEN")

        plain_secret = decrypt_secret(user.totp_secret, self.settings.totp_encryption_key)
        if not verify_totp_code(plain_secret, code):
            raise ValueError("INVALID_TOTP_CODE")

        refresh_token = self.create_refresh_token(user_id)
        self.repo.save_refresh_token(user_id, refresh_token)
        return self._build_token_response(user_id, refresh_token)

    def setup_totp(self, user_id: int) -> TotpSetupResponse:
        """Generate a new TOTP secret and persist it encrypted — 2FA is NOT enabled yet.
        Returns the otpauth:// URI (for QR) and the plain secret (for manual entry)."""
        user = self.repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise ValueError("USER_NOT_FOUND")

        plain_secret = generate_totp_secret()
        encrypted = encrypt_secret(plain_secret, self.settings.totp_encryption_key)
        self.repo.save_totp_secret(user_id, encrypted)

        uri = build_totp_uri(plain_secret, user.email)
        return TotpSetupResponse(uri=uri, secret=plain_secret)

    def confirm_totp_setup(self, user_id: int, code: str) -> None:
        """Verify the first TOTP code from the authenticator app, then activate 2FA."""
        user = self.repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None or not user.totp_secret:
            raise ValueError("TOTP_NOT_INITIALIZED")

        plain_secret = decrypt_secret(user.totp_secret, self.settings.totp_encryption_key)
        if not verify_totp_code(plain_secret, code):
            raise ValueError("INVALID_TOTP_CODE")

        self.repo.enable_totp(user_id)

    def disable_totp(self, user_id: int, code: str) -> None:
        """Disable 2FA — requires a valid current TOTP code to prevent abuse via stolen password."""
        user = self.repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise ValueError("USER_NOT_FOUND")
        if not user.totp_enabled or not user.totp_secret:
            raise ValueError("TOTP_NOT_ENABLED")

        plain_secret = decrypt_secret(user.totp_secret, self.settings.totp_encryption_key)
        if not verify_totp_code(plain_secret, code):
            raise ValueError("INVALID_TOTP_CODE")

        self.repo.disable_totp(user_id)

    def get_biometric_status(self, user_id: int) -> BiometricStatusResponse:
        credentials = self.repo.list_biometric_credentials(user_id)
        return BiometricStatusResponse(
            enabled=bool(credentials),
            credential_count=len(credentials),
        )

    def begin_biometric_registration(self, user_id: int) -> BiometricRegistrationOptionsResponse:
        user = self.repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise ValueError("USER_NOT_FOUND")

        existing_credentials = self.repo.list_biometric_credentials(user_id)
        exclude_credentials = [
            PublicKeyCredentialDescriptor(id=_base64url_decode(row.credential_id))
            for row in existing_credentials
        ]

        options = generate_registration_options(
            rp_id=self.settings.webauthn_rp_id,
            rp_name=self.settings.webauthn_rp_name,
            user_id=str(user_id).encode("utf-8"),
            user_name=user.email,
            user_display_name=f"{user.first_name} {user.last_name}".strip() or user.email,
            authenticator_selection=AuthenticatorSelectionCriteria(
                authenticator_attachment=AuthenticatorAttachment.PLATFORM,
                resident_key=ResidentKeyRequirement.PREFERRED,
                user_verification=UserVerificationRequirement.REQUIRED,
            ),
            exclude_credentials=exclude_credentials,
        )
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=self.settings.webauthn_registration_challenge_expire_minutes,
        )
        challenge = self.repo.create_biometric_registration_challenge(
            user_id,
            _base64url_encode(options.challenge),
            expires_at,
        )

        return BiometricRegistrationOptionsResponse(
            challenge_id=challenge.challenge_id,
            publicKey=json.loads(options_to_json(options)),
        )

    def complete_biometric_registration(
        self,
        user_id: int,
        payload: BiometricRegistrationCompleteRequest,
    ) -> BiometricCredentialResponse:
        user = self.repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise ValueError("USER_NOT_FOUND")

        challenge = self.repo.get_biometric_registration_challenge(
            user_id,
            payload.challenge_id,
        )
        if (
            challenge is None
            or challenge.used_at is not None
            or self._is_expired(challenge.expires_at)
        ):
            raise ValueError("INVALID_OR_EXPIRED_BIOMETRIC_CHALLENGE")

        origins = self.settings.webauthn_origin_list or self.settings.cors_origin_list
        try:
            verified = verify_registration_response(
                credential=payload.credential,
                expected_challenge=_base64url_decode(challenge.challenge),
                expected_rp_id=self.settings.webauthn_rp_id,
                expected_origin=origins,
                require_user_verification=True,
            )
        except InvalidRegistrationResponse as exc:
            raise ValueError("INVALID_BIOMETRIC_REGISTRATION") from exc

        credential_id = _base64url_encode(verified.credential_id)
        try:
            row = self.repo.create_biometric_credential(
                user_id=user_id,
                credential_id=credential_id,
                public_key=verified.credential_public_key,
                sign_count=verified.sign_count,
                aaguid=verified.aaguid,
                device_type=verified.credential_device_type.value,
                backed_up=verified.credential_backed_up,
            )
        except IntegrityError as exc:
            raise ValueError("BIOMETRIC_CREDENTIAL_ALREADY_EXISTS") from exc

        self.repo.mark_biometric_registration_challenge_used(challenge.challenge_id)
        return BiometricCredentialResponse(
            credential_id=row.credential_id,
            device_type=row.device_type,
            backed_up=row.backed_up,
        )

    def disable_biometric_authentication(self, user_id: int) -> BiometricStatusResponse:
        user = self.repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise ValueError("USER_NOT_FOUND")

        credentials = self.repo.list_biometric_credentials(user_id)
        if credentials:
            raise ValueError("BIOMETRIC_VERIFICATION_REQUIRED")

        self.repo.delete_biometric_credentials(user_id)
        return BiometricStatusResponse(enabled=False, credential_count=0)

    def begin_biometric_disable(self, user_id: int) -> BiometricAuthenticationOptionsResponse:
        user = self.repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise ValueError("USER_NOT_FOUND")

        credentials = self.repo.list_biometric_credentials(user_id)
        if not credentials:
            raise ValueError("BIOMETRIC_NOT_ENABLED")

        options = generate_authentication_options(
            rp_id=self.settings.webauthn_rp_id,
            allow_credentials=[
                PublicKeyCredentialDescriptor(id=_base64url_decode(credential.credential_id))
                for credential in credentials
            ],
            user_verification=UserVerificationRequirement.REQUIRED,
        )
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=self.settings.webauthn_registration_challenge_expire_minutes,
        )
        challenge = self.repo.create_biometric_authentication_challenge(
            user_id=user_id,
            transaction_id=None,
            challenge=_base64url_encode(options.challenge),
            expires_at=expires_at,
        )

        return BiometricAuthenticationOptionsResponse(
            challenge_id=challenge.challenge_id,
            publicKey=json.loads(options_to_json(options)),
        )

    def complete_biometric_disable(
        self,
        user_id: int,
        payload: BiometricDisableRequest,
    ) -> BiometricStatusResponse:
        user = self.repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise ValueError("USER_NOT_FOUND")

        credential_id = payload.credential.get("rawId") or payload.credential.get("id")
        if not isinstance(credential_id, str):
            raise ValueError("INVALID_BIOMETRIC_AUTHENTICATION")

        credential = self.repo.get_biometric_credential(user_id, credential_id)
        if credential is None:
            raise ValueError("INVALID_BIOMETRIC_AUTHENTICATION")

        challenge = self.repo.get_biometric_authentication_challenge(
            user_id=user_id,
            transaction_id=None,
            challenge_id=payload.challenge_id,
        )
        if (
            challenge is None
            or challenge.used_at is not None
            or self._is_expired(challenge.expires_at)
        ):
            raise ValueError("INVALID_OR_EXPIRED_BIOMETRIC_CHALLENGE")

        origins = self.settings.webauthn_origin_list or self.settings.cors_origin_list
        try:
            verified = verify_authentication_response(
                credential=payload.credential,
                expected_challenge=_base64url_decode(challenge.challenge),
                expected_rp_id=self.settings.webauthn_rp_id,
                expected_origin=origins,
                credential_public_key=credential.public_key,
                credential_current_sign_count=credential.sign_count,
                require_user_verification=True,
            )
        except WebAuthnException as exc:
            raise ValueError("INVALID_BIOMETRIC_AUTHENTICATION") from exc

        self.repo.mark_biometric_authentication_challenge_used(challenge.challenge_id)
        self.repo.update_biometric_credential_usage(
            credential_row_id=credential.credential_row_id,
            sign_count=verified.new_sign_count,
        )
        self.repo.delete_biometric_credentials(user_id)
        return BiometricStatusResponse(enabled=False, credential_count=0)

    def refresh(self, refresh_token: str) -> TokenResponse | None:
        user_id = self.verify_refresh_token(refresh_token)
        if user_id is None:
            return None

        user = self.repo.get_user_by_refresh_token(refresh_token)
        if user is None or user.user_id != user_id:
            return None

        new_refresh_token = self.create_refresh_token(user_id)
        self.repo.save_refresh_token(user_id, new_refresh_token)
        return self._build_token_response(user_id, new_refresh_token)

    def logout(self, token: str) -> bool:
        user_id = self.resolve_active_user_id(token)
        if user_id is None:
            return False
        self.repo.clear_refresh_token(user_id)
        return True

    def change_password(self, user_id: int, payload: ChangePasswordRequest) -> None:
        user = self.repo.get_user_by_id(user_id)
        if not user:
            raise ValueError("USER_NOT_FOUND")
        if user.deleted_at is not None:
            raise ValueError("USER_NOT_FOUND")
        if not self.verify_password(payload.current_password, user.password_hash):
            raise ValueError("WRONG_CURRENT_PASSWORD")
        new_hash = self.hash_password(payload.new_password)
        self.repo.update_password_and_clear_refresh_token(user_id, new_hash)

    def request_password_reset(self, payload: PasswordResetRequest) -> None:
        user = self.repo.get_user_by_email(str(payload.email))
        if user is None or user.deleted_at is not None:
            return

        token = secrets.token_urlsafe(48)
        token_hash = self._hash_reset_token(token)
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=self.settings.password_reset_token_expire_minutes
        )
        self.repo.create_password_reset_token(user.user_id, token_hash, expires_at)

        try:
            self.password_reset_mailer.send_reset_link(
                user.email,
                self._build_password_reset_url(token),
            )
        except Exception as exc:
            raise ValueError("MAIL_DELIVERY_FAILED") from exc

    def confirm_password_reset(self, payload: PasswordResetConfirmRequest) -> None:
        token_hash = self._hash_reset_token(payload.token)
        row = self.repo.get_password_reset_token(token_hash)
        if row is None or row.used_at is not None or self._is_expired(row.expires_at):
            raise ValueError("INVALID_OR_EXPIRED_RESET_TOKEN")

        user = self.repo.get_user_by_id(row.user_id)
        if user is None or user.deleted_at is not None:
            raise ValueError("INVALID_OR_EXPIRED_RESET_TOKEN")

        new_hash = self.hash_password(payload.new_password)
        self.repo.update_password_and_clear_refresh_token(user.user_id, new_hash)
        self.repo.mark_password_reset_tokens_used_for_user(user.user_id)

    def accept_invitation(
        self,
        user_id: int,
        payload: AcceptInvitationRequest,
        access_token: str,
    ) -> TokenResponse:
        user = self.repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None:
            raise ValueError("USER_NOT_FOUND")

        new_hash = self.hash_password(payload.new_password)
        try:
            updated_user = self.repo.complete_invitation(user_id, new_hash)
        except ValueError as exc:
            if str(exc) == "NOT_INVITED":
                raise ValueError("NOT_INVITED") from exc
            raise
        if updated_user is None:
            raise ValueError("USER_NOT_FOUND")

        new_refresh = self.create_refresh_token(user_id)
        self.repo.save_refresh_token(user_id, new_refresh)
        return self._build_token_response_for_user(
            updated_user,
            new_refresh,
            access_token=access_token,
        )

    def deactivate_account(self, user_id: int, payload: DeactivateAccountRequest) -> None:
        user = self.repo.get_user_by_id(user_id)
        if not user:
            raise ValueError("USER_NOT_FOUND")
        if user.deleted_at is not None:
            raise ValueError("ALREADY_DEACTIVATED")
        if not self.verify_password(payload.current_password, user.password_hash):
            raise ValueError("WRONG_CURRENT_PASSWORD")
        self.repo.soft_delete_user(user_id)

    def update_profile(self, token: str, payload: ProfileUpdateRequest) -> TokenResponse | None:
        user_id = self.verify_access_token(token)
        if user_id is None:
            return None

        current_user = self.repo.get_user_by_id(user_id)
        if not current_user or current_user.deleted_at is not None:
            return None

        if payload.email is not None:
            existing_user = self.repo.get_user_by_email(str(payload.email))
            if existing_user and existing_user.user_id != user_id:
                raise ValueError("EMAIL_NOT_AVAILABLE")

        previous_avatar_url = getattr(current_user, "avatar_url", None)
        payload_keys = payload.model_dump(exclude_unset=True)
        updating_avatar = "avatar_url" in payload_keys

        updated_user = self.repo.update_profile(user_id, payload)
        if not updated_user:
            return None

        if updating_avatar and previous_avatar_url:
            new_avatar_url = getattr(updated_user, "avatar_url", None)
            if new_avatar_url != previous_avatar_url:
                from services.storage.avatar_display_url import delete_managed_avatar_for_user

                delete_managed_avatar_for_user(
                    previous_avatar_url,
                    user_id=user_id,
                    settings=self.settings,
                )

        return self._build_token_response_for_user(
            updated_user,
            updated_user.refresh_token or "",
            access_token=token,
        )

    def get_me(self, token: str) -> TokenResponse | None:
        user_id = self.verify_access_token(token)
        if user_id is None:
            return None

        user = self.repo.get_user_by_id(user_id)
        if not user or user.deleted_at is not None:
            return None

        return self._build_token_response_for_user(
            user,
            user.refresh_token or "",
            access_token=token,
        )

    def update_notification_preferences(
        self, token: str, preferences: NotificationPreferencesUpdate
    ) -> TokenResponse | None:
        user_id = self.resolve_active_user_id(token)
        if user_id is None:
            return None

        self.repo.update_notification_preferences(
            user_id,
            billing_reminders_enabled=preferences.billing_reminders_enabled,
            email_payment_sent_enabled=preferences.email_payment_sent_enabled,
            email_payment_received_enabled=preferences.email_payment_received_enabled,
            email_topup_enabled=preferences.email_topup_enabled,
            email_refund_status_enabled=preferences.email_refund_status_enabled,
        )
        user = self.repo.get_user_by_id(user_id)
        if user is None:
            return None

        return self._build_token_response_for_user(
            user,
            user.refresh_token or "",
            access_token=token,
        )
