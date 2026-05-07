from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError

from repositories.user.auth import UserAuthRepository
from schemas.user.auth import (
    ChangePasswordRequest,
    DeactivateAccountRequest,
    LoginRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from settings import get_settings


class UserAuthService:
    def __init__(self, repo: UserAuthRepository) -> None:
        self.repo = repo
        self.settings = get_settings()

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
        try:
            payload = jwt.decode(
                token, self.settings.secret_key, algorithms=[self.settings.algorithm]
            )
            if payload.get("type") != "access":
                return None
            user_id: str = payload.get("sub")
            if user_id is None:
                return None
            return int(user_id)
        except InvalidTokenError:
            return None

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
        user_response = UserResponse(
            id=user.user_id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            created_at=user.created_at,
            user_role_id=user.user_role_id,
            role_name=role_name,
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
        user_id = self.verify_access_token(token)
        if user_id is None:
            return False
        self.repo.clear_refresh_token(user_id)
        return True

    def change_password(self, user_id: int, payload: ChangePasswordRequest) -> None:
        user = self.repo.get_user_by_id(user_id)
        if not user:
            raise ValueError("USER_NOT_FOUND")
        if not self.verify_password(payload.current_password, user.password_hash):
            raise ValueError("WRONG_CURRENT_PASSWORD")
        new_hash = self.hash_password(payload.new_password)
        self.repo.update_password(user_id, new_hash)

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
        if not current_user:
            return None

        if payload.email is not None:
            existing_user = self.repo.get_user_by_email(str(payload.email))
            if existing_user and existing_user.user_id != user_id:
                raise ValueError("EMAIL_NOT_AVAILABLE")

        updated_user = self.repo.update_profile(user_id, payload)
        if not updated_user:
            return None

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
        if not user:
            return None

        return self._build_token_response_for_user(
            user,
            user.refresh_token or "",
            access_token=token,
        )
