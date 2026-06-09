from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.user_role import UserRole
from models.user_status import UserStatus
from models.password_reset_token import PasswordResetToken
from models.user import User
from schemas.user.auth import ProfileUpdateRequest, RegisterRequest

_ACTIVE_STATUS_NAME = "active"
_DEFAULT_USER_ROLE_NAME = "user"


class UserAuthRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_user_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return self._db.scalars(stmt).first()

    def _get_status_id_by_name(self, status_name: str) -> int:
        status_id = self._db.execute(
            select(UserStatus.id).where(UserStatus.status_name == status_name)
        ).scalar_one_or_none()
        if status_id is None:
            raise ValueError(f"Missing required user status: {status_name}")
        return status_id

    def _get_role_id_by_name(self, role_name: str) -> int:
        role_id = self._db.execute(
            select(UserRole.role_id).where(UserRole.role_name == role_name)
        ).scalar_one_or_none()
        if role_id is None:
            raise ValueError(f"Missing required user role: {role_name}")
        return role_id

    def create_user(self, user_data: RegisterRequest, hashed_password: str) -> User:
        active_status_id = self._get_status_id_by_name(_ACTIVE_STATUS_NAME)
        default_role_id = self._get_role_id_by_name(_DEFAULT_USER_ROLE_NAME)

        user = User(
            email=str(user_data.email),
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            password_hash=hashed_password,
            address=None,
            status_id=active_status_id,
            user_role_id=default_role_id,
        )
        try:
            self._db.add(user)
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(user)
        return user

    def get_user_by_id(self, user_id: int) -> User | None:
        stmt = select(User).where(User.user_id == user_id)
        return self._db.scalars(stmt).first()

    def get_role_name_for_user(self, user_role_id: int) -> str:
        role_name = self._db.execute(
            select(UserRole.role_name).where(UserRole.role_id == user_role_id)
        ).scalar_one_or_none()
        return role_name or "user"

    def get_user_by_refresh_token(self, refresh_token: str) -> User | None:
        stmt = select(User).where(
            User.refresh_token == refresh_token,
            User.deleted_at.is_(None),
        )
        return self._db.scalars(stmt).first()

    def save_refresh_token(self, user_id: int, refresh_token: str) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(refresh_token=refresh_token)
        )
        self._db.commit()

    def clear_refresh_token(self, user_id: int) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(refresh_token=None)
        )
        self._db.commit()

    def create_password_reset_token(
        self,
        user_id: int,
        token_hash: str,
        expires_at: datetime,
    ) -> PasswordResetToken:
        row = PasswordResetToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def get_password_reset_token(self, token_hash: str) -> PasswordResetToken | None:
        stmt = select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        return self._db.scalars(stmt).first()

    def mark_password_reset_token_used(self, token_id: int) -> None:
        self._db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.token_id == token_id)
            .values(used_at=datetime.now(timezone.utc))
        )
        self._db.commit()

    def mark_password_reset_tokens_used_for_user(self, user_id: int) -> None:
        self._db.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user_id,
                PasswordResetToken.used_at.is_(None),
            )
            .values(used_at=datetime.now(timezone.utc))
        )
        self._db.commit()

    def update_profile(self, user_id: int, payload: ProfileUpdateRequest) -> User | None:
        values = payload.model_dump(exclude_unset=True)
        if not values:
            return self.get_user_by_id(user_id)

        values["modified_at"] = datetime.now(timezone.utc)

        try:
            self._db.execute(
                update(User)
                .where(User.user_id == user_id)
                .values(**values)
            )
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise

        return self.get_user_by_id(user_id)

    def update_password(self, user_id: int, hashed_password: str) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(password_hash=hashed_password)
        )
        self._db.commit()

    def update_password_and_clear_refresh_token(
        self,
        user_id: int,
        hashed_password: str,
    ) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(password_hash=hashed_password, refresh_token=None)
        )
        self._db.commit()

    def soft_delete_user(self, user_id: int) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(deleted_at=datetime.now(timezone.utc), refresh_token=None)
        )
        self._db.commit()

    def update_notification_preferences(
        self, user_id: int, billing_reminders_enabled: bool
    ) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(
                billing_reminders_enabled=billing_reminders_enabled,
                modified_at=datetime.now(timezone.utc),
            )
        )
        self._db.commit()
