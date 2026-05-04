import bcrypt
from sqlalchemy.exc import IntegrityError

from models.user import User
from repositories.user.crud import UserRepository
from schemas.user.crud import UserCreateRequest, UserUpdateRequest


class UserNotFoundError(Exception):
    """User does not exist."""


class DuplicateEmailError(Exception):
    """Email must be unique."""


class InvalidUserRoleError(Exception):
    """Provided user role ID does not exist."""


class InvalidUserStatusError(Exception):
    """Provided user status ID does not exist."""


class UserService:
    def __init__(self, repo: UserRepository) -> None:
        self._repo = repo

    @staticmethod
    def _hash_password(password: str) -> str:
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

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
        return self._repo.list_users(
            email=email,
            status_id=status_id,
            user_role_id=user_role_id,
            include_deleted=include_deleted,
            limit=limit,
            offset=offset,
        )

    def get_user(self, user_id: int, *, include_deleted: bool) -> User:
        row = self._repo.get_by_id(user_id)
        if row is None or (row.deleted_at is not None and not include_deleted):
            raise UserNotFoundError()
        return row

    def create_user(self, payload: UserCreateRequest) -> User:
        if not self._repo.user_role_exists(payload.user_role_id):
            raise InvalidUserRoleError()
        if not self._repo.user_status_exists(payload.status_id):
            raise InvalidUserStatusError()

        user = User(
            email=str(payload.email),
            first_name=payload.first_name,
            last_name=payload.last_name,
            password_hash=self._hash_password(payload.password),
            address=payload.address,
            status_id=payload.status_id,
            user_role_id=payload.user_role_id,
        )
        try:
            return self._repo.create(user)
        except IntegrityError as exc:
            raise DuplicateEmailError() from exc

    def update_user(self, user_id: int, payload: UserUpdateRequest) -> User:
        row = self._repo.get_by_id(user_id)
        if row is None or row.deleted_at is not None:
            raise UserNotFoundError()

        if payload.user_role_id is not None and not self._repo.user_role_exists(payload.user_role_id):
            raise InvalidUserRoleError()
        if payload.status_id is not None and not self._repo.user_status_exists(payload.status_id):
            raise InvalidUserStatusError()

        if payload.email is not None:
            existing = self._repo.get_by_email(str(payload.email))
            if existing is not None and existing.user_id != row.user_id:
                raise DuplicateEmailError()
            row.email = str(payload.email)
        if payload.first_name is not None:
            row.first_name = payload.first_name
        if payload.last_name is not None:
            row.last_name = payload.last_name
        if payload.address is not None:
            row.address = payload.address
        if payload.status_id is not None:
            row.status_id = payload.status_id
        if payload.user_role_id is not None:
            row.user_role_id = payload.user_role_id
        if payload.password is not None:
            row.password_hash = self._hash_password(payload.password)

        try:
            return self._repo.save(row)
        except IntegrityError as exc:
            raise DuplicateEmailError() from exc

    def delete_user(self, user_id: int) -> None:
        row = self._repo.get_by_id(user_id)
        if row is None:
            raise UserNotFoundError()
        if row.deleted_at is None:
            self._repo.soft_delete(row)
