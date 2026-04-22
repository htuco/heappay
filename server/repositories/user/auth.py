from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.user import User
from schemas.user.auth import RegisterRequest

# No last_login column yet; bump modified_at on successful auth activity.
_ACTIVE_STATUS_ID = 1
_DEFAULT_USER_ROLE_ID = 1


class UserAuthRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_user_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return self._db.scalars(stmt).first()

    def create_user(self, user_data: RegisterRequest, hashed_password: str) -> User:
        user = User(
            email=str(user_data.email),
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            password_hash=hashed_password,
            address=None,
            status_id=_ACTIVE_STATUS_ID,
            user_role_id=_DEFAULT_USER_ROLE_ID,
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

    def update_last_login(self, user_id: int) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(modified_at=func.now())
        )
        self._db.commit()
