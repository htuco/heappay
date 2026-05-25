from datetime import datetime, timezone

from sqlalchemy import Select, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.card import Card
from models.card_status import CardStatus
from models.card_type import CardType
from models.user import User
from models.user_role import UserRole
from models.user_status import UserStatus


UserSearchRow = tuple[User, Card | None, str | None]


class UserRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

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
    ) -> list[User]:
        stmt: Select[tuple[User]] = select(User).order_by(User.user_id)
        if q is not None:
            pattern = f"%{q}%"
            stmt = stmt.where(
                or_(
                    User.email.ilike(pattern),
                    User.first_name.ilike(pattern),
                    User.last_name.ilike(pattern),
                )
            )
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

    def search(self, q: str, exclude_user_id: int, limit: int) -> list[UserSearchRow]:
        default_card_id = (
            select(Card.card_id)
            .join(CardStatus, Card.status_id == CardStatus.card_status_id)
            .where(
                Card.user_id == User.user_id,
                Card.deleted_at.is_(None),
                CardStatus.status_name.ilike("active"),
            )
            .order_by(Card.created_at, Card.card_id)
            .limit(1)
            .correlate(User)
            .scalar_subquery()
        )
        pattern = f"%{q}%"
        stmt = (
            select(User, Card, CardType.vendor)
            .select_from(User)
            .outerjoin(Card, Card.card_id == default_card_id)
            .outerjoin(CardType, Card.card_type_id == CardType.card_type_id)
            .where(
                User.deleted_at.is_(None),
                User.user_id != exclude_user_id,
                or_(
                    User.email.ilike(pattern),
                    User.first_name.ilike(pattern),
                    User.last_name.ilike(pattern),
                ),
            )
            .order_by(User.first_name, User.last_name, User.user_id)
            .limit(limit)
        )
        return list(self._db.execute(stmt).all())

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
