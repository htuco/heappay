from datetime import datetime, timedelta, timezone
import hashlib
import secrets
from typing import Optional
from urllib.parse import urlencode

import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError

from repositories.user.auth import UserAuthRepository
from services.storage.avatar_display_url import resolve_avatar_url_for_client
from schemas.user.auth import (
    AcceptInvitationRequest,
    ChangePasswordRequest,
    DeactivateAccountRequest,
    LoginRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from services.user.password_reset_mailer import PasswordResetMailer
from settings import get_settings


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
            avatar_url=resolve_avatar_url_for_client(raw_avatar, self.settings),
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

    def login(self, login_data: LoginRequest) -> TokenResponse:
        user = self.repo.get_user_by_email(str(login_data.email))
        if not user or user.deleted_at is not None:
            raise ValueError("Invalid email or password")

        if not self.verify_password(login_data.password, user.password_hash):
            raise ValueError("Invalid email or password")

        refresh_token = self.create_refresh_token(user.user_id)
        self.repo.save_refresh_token(user.user_id, refresh_token)
        return self._build_token_response(user.user_id, refresh_token)

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
        self, token: str, billing_reminders_enabled: bool
    ) -> TokenResponse | None:
        user_id = self.resolve_active_user_id(token)
        if user_id is None:
            return None

        self.repo.update_notification_preferences(user_id, billing_reminders_enabled)
        user = self.repo.get_user_by_id(user_id)
        if user is None:
            return None

        return self._build_token_response_for_user(
            user,
            user.refresh_token or "",
            access_token=token,
        )
