from datetime import datetime, timezone

from sqlalchemy import Select, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.user import User
from models.user_role import UserRole
from models.user_status import UserStatus


class UserRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_users(
        self,
        *,
        email: str | None,
        status_id: int | None,
        user_role_id: int | None,
        include_deleted: bool,
        limit: int,
        offset: int,
    ) -> list[User]:
        stmt: Select[tuple[User]] = select(User).order_by(User.user_id)
        if email is not None:
            stmt = stmt.where(User.email == email)
        if status_id is not None:
            stmt = stmt.where(User.status_id == status_id)
        if user_role_id is not None:
            stmt = stmt.where(User.user_role_id == user_role_id)
        if not include_deleted:
            stmt = stmt.where(User.deleted_at.is_(None))
        stmt = stmt.limit(limit).offset(offset)
        return list(self._db.scalars(stmt))

    def get_by_id(self, user_id: int) -> User | None:
        stmt = select(User).where(User.user_id == user_id)
        return self._db.scalars(stmt).first()

    def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return self._db.scalars(stmt).first()

    def user_role_exists(self, user_role_id: int) -> bool:
        stmt = select(UserRole.role_id).where(UserRole.role_id == user_role_id)
        return self._db.execute(stmt).scalar_one_or_none() is not None

    def user_status_exists(self, status_id: int) -> bool:
        stmt = select(UserStatus.id).where(UserStatus.id == status_id)
        return self._db.execute(stmt).scalar_one_or_none() is not None

    def create(self, row: User) -> User:
        try:
            self._db.add(row)
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(row)
        return row

    def save(self, row: User) -> User:
        row.modified_at = datetime.now(timezone.utc)
        try:
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(row)
        return row

    def soft_delete(self, row: User) -> None:
        now = datetime.now(timezone.utc)
        row.deleted_at = now
        row.modified_at = now
        self._db.commit()
